/* eslint-disable no-await-in-loop */
/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const { buildTaggingXml } = require('../helpers/aws-tags');
const { isInternalResearcher, isAdmin, isSystem } = require('../helpers/is-role');
const { normalizeStudyFolder } = require('../helpers/utils');
const {
  isOpenData,
  isMyStudies,
  accessLevels,
  permissionLevels,
  toStudyEntity,
  toDbEntity,
} = require('./helpers/entities/study-methods');
const { isAdmin: isStudyAdmin } = require('./helpers/entities/study-permissions-methods');
const { getStudyIds } = require('./helpers/entities/user-permissions-methods');
const registerSchema = require('../schema/register-study');
const createSchema = require('../schema/create-study');
const updateSchema = require('../schema/update-study');
const getPermissionsSchema = require('../schema/get-study-permissions');

const settingKeys = {
  tableName: 'dbStudies',
  categoryIndexName: 'dbStudiesCategoryIndex',
  accountIdIndexName: 'dbStudiesAccountIdIndex',
  studyDataBucketName: 'studyDataBucketName',
};

class StudyService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'dbService',
      'studyPermissionService',
      'projectService',
      'auditWriterService',
    ]);
  }

  async init() {
    await super.init();
    const [aws, dbService] = await this.service(['aws', 'dbService']);
    this.s3Client = new aws.sdk.S3();

    const table = this.settings.get(settingKeys.tableName);
    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);

    this.categoryIndex = this.settings.get(settingKeys.categoryIndexName);
    this.accountIdIndex = this.settings.get(settingKeys.accountIdIndexName);
    this.studyDataBucket = this.settings.get(settingKeys.studyDataBucketName);
  }

  /**
   * IMPORTANT: Do NOT call this method directly from a controller, this is because
   * this method does not do any authorization check.  It will return the study given
   * a study id no matter who the requestContext principal is.
   */
  async find(requestContext, id, fields = []) {
    const result = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    return toStudyEntity(result);
  }

  /**
   * IMPORTANT: Do NOT call this method directly from a controller, this is because
   * this method does not do any authorization check.  It will return the study given
   * a study id no matter who the requestContext principal is.
   */
  async mustFind(requestContext, id, fields = []) {
    const result = await this.find(requestContext, id, fields);
    if (!result) throw this.notFoundError(id);
    return result;
  }

  async listByIds(requestContext, ids, fields = []) {
    if (!isAdmin(requestContext)) {
      throw this.boom.forbidden('Only admins are authorized to list by ids.', true);
    }

    const result = await this._getter()
      .keys(ids)
      .projection(fields)
      .get();

    return result.map(toStudyEntity);
  }

  /**
   * Returns a StudyEntity with the permissions attribute populated.
   * If the study is not found an exception is thrown. If the requestContext.principal
   * is not an admin and does not have any permissions for the study then an exception
   * is thrown (unless it is open data).
   *
   * The StudyEntity has this shape:
   * {
   *  id, rev, category, name, description, resources: [{arn, fileShareArn}, ...],
   *  uploadLocationEnabled, sha, qualifier, folder, accountId, bucket, awsPartition,
   *  region, kmsArn, status, statusMsg, accessType, projectId, bucketAccess, kmsScope
   *  permissions: <StudyPermissionEntity>
   * }
   *
   * Not all of the attributes are available for a study. For example, if a study is using
   * the default bucket, it won't have the accountId, bucket, bucketPartition, bucketRegion,
   * kmsArn populated.
   *
   * @param requestContext The standard requestContext
   * @param id The study id
   * @param fields An array of the attribute names to return, default to all the attributes
   * of the study entity.
   */
  async getStudyPermissions(requestContext, id, fields = []) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid({ id }, getPermissionsSchema);

    const studyEntity = await this.mustFind(requestContext, id, fields);
    const [studyPermissionService] = await this.service(['studyPermissionService']);

    const studyPermissionEntity = await studyPermissionService.findStudyPermissions(requestContext, studyEntity);
    return { ...studyEntity, permissions: studyPermissionEntity };
  }

  /**
   * Returns the user permissions entity. Admins can call this method for
   * any user, however, if the requestContext.principal is not an admin and is not
   * the same as the given uid, an exception is thrown. If no user entry is found,
   * a userPermissionsEntity is returned but with no values in arrays such as adminAccess:[], etc.
   *
   * The userPermissionsEntity has the following shape:
   * {
   *  uid: <userId>,
   *  adminAccess: [<studyId>, ...]
   *  readonlyAccess: [<studyId>, ...]
   *  readwriteAccess: [<studyId>, ...]
   *  writeonlyAccess: [<studyId>, ...]
   *  updateBy, updateAt, createdBy, createdAt
   * }
   *
   * @param requestContext The standard requestContext
   * @param uid The user id
   * @param fields An array of the attribute names to return, default to all the attributes
   * of the user permissions entity.
   */
  async getUserPermissions(requestContext, uid, fields = []) {
    const [studyPermissionService] = await this.service(['studyPermissionService']);

    return studyPermissionService.findUserPermissions(requestContext, uid, fields);
  }

  // WARNING!! This method is not meant to be called directly from a controller,
  // if you need to do that, use dataSourceRegistrationService.registerStudy() instead.
  async register(requestContext, accountEntity, bucketEntity, rawStudyEntity) {
    if (!isAdmin(requestContext)) {
      throw this.boom.forbidden('Only admins are authorized to register studies.', true);
    }

    const [validationService, studyPermissionService, projectService] = await this.service([
      'jsonSchemaValidationService',
      'studyPermissionService',
      'projectService',
    ]);

    // Validate input
    await validationService.ensureValid(rawStudyEntity, registerSchema);

    let studyPermissionEntity = {
      adminUsers: rawStudyEntity.adminUsers,
    };

    // We need to call this in case there are problems with the study permissions entity. We need
    // to find this out before we create the study, otherwise, it will be too late if we create the
    // study entity and then try to create the study permissions entity only to find out that it has
    // validation issues. In addition, we want to make sure that we can store the studyEntity in the
    // database first before we store the study permissions entity.
    await studyPermissionService.preCreateValidation(requestContext, rawStudyEntity, studyPermissionEntity);

    // Lets check to see if kmsArn is not provided if scope is bucket
    if (
      !_.isEmpty(rawStudyEntity.kmsArn) &&
      (rawStudyEntity.kmsScope === 'bucket' || rawStudyEntity.kmsScope === 'none')
    ) {
      throw this.boom.badRequest('You can not provide a KMS ARN when KMS scope is the bucket or none', true);
    }

    // Lets also check if kmsScope is bucket but the bucket does not have kmsArn
    if (rawStudyEntity.kmsScope === 'bucket' && _.isEmpty(bucketEntity.kmsArn)) {
      throw this.boom.badRequest(
        'KMS scope is bucket, but the bucket does not have a kms key associated with it',
        true,
      );
    }

    // Lets also check that we have kmsArn if kmsScope is "study"
    if (rawStudyEntity.kmsScope === 'study' && _.isEmpty(rawStudyEntity.kmsArn)) {
      throw this.boom.badRequest('KMS scope is study, but no kmsArn is provided', true);
    }

    if (!_.isEmpty(rawStudyEntity.projectId)) {
      await projectService.mustFind(requestContext, { id: rawStudyEntity.projectId });
    }

    // Does the folder overlap with existing ones?
    const overlap = await this.isOverlapping(
      requestContext,
      accountEntity.id,
      bucketEntity.name,
      rawStudyEntity.folder,
    );

    if (overlap) {
      throw this.boom.badRequest('The study folder overlaps with an existing study folder', true);
    }

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const entity = {
      ..._.omit(rawStudyEntity, ['adminUsers']),
      folder: normalizeStudyFolder(rawStudyEntity.folder),
      qualifier: accountEntity.qualifier,
      accountId: accountEntity.id,
      bucket: bucketEntity.name,
      bucketAccess: bucketEntity.access,
      awsPartition: bucketEntity.awsPartition,
      region: bucketEntity.region,
      status: 'pending',
      statusAt: new Date().toISOString(),
      rev: 0,
      createdBy: by,
      updatedBy: by,
    };

    const studyEntity = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // Error if already exists
          .key({ id: entity.id })
          .item(_.omit(entity, 'id'))
          .update();
      },
      async () => {
        throw this.boom.badRequest(`study with id "${entity.id}" already exists`, true);
      },
    );

    // Time to create the study permissions entity and all the needed user permissions entities.
    studyPermissionEntity = await studyPermissionService.create(requestContext, studyEntity, studyPermissionEntity);
    return { ...studyEntity, permissions: studyPermissionEntity };
  }

  async create(requestContext, rawStudyEntity) {
    if (!(isInternalResearcher(requestContext) || isAdmin(requestContext))) {
      throw this.boom.forbidden('Only admin and internal researcher are authorized to create studies.', true);
    }
    if (isOpenData(rawStudyEntity) && !isSystem(requestContext)) {
      throw this.boom.forbidden('Only the system can create Open Data studies.', true);
    }
    if (isOpenData(rawStudyEntity) && _.get(rawStudyEntity, 'accessType') === 'readwrite') {
      throw this.boom.badRequest('Open Data study cannot be read/write', true);
    }

    const [validationService, studyPermissionService, projectService] = await this.service([
      'jsonSchemaValidationService',
      'studyPermissionService',
      'projectService',
    ]);

    // Validate input
    await validationService.ensureValid(rawStudyEntity, createSchema);

    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');

    // The open data studies do not need to be associated to any project
    // for everything else make sure projectId is specified
    if (!isOpenData(rawStudyEntity)) {
      const projectId = rawStudyEntity.projectId;
      if (!projectId) {
        throw this.boom.badRequest('Missing required projectId', true);
      }
      // Verify user has access to the project the new study will be associated with
      if (!(await projectService.verifyUserProjectAssociation(by, projectId))) {
        throw this.boom.forbidden(`Not authorized to add study related to project "${projectId}"`, true);
      }
      await projectService.mustFind(requestContext, { id: rawStudyEntity.projectId });
      // Verify user is not trying to create resources for non-Open data studies
      if (!_.isEmpty(rawStudyEntity.resources)) {
        throw this.boom.forbidden('Resources can only be assigned to Open Data study category', true);
      }
    }

    const id = rawStudyEntity.id;

    // Prepare the db object
    const dbObject = toDbEntity(rawStudyEntity, { rev: 0, createdBy: by, updatedBy: by });

    // Create file upload location if necessary
    let studyFileLocation;
    if (rawStudyEntity.uploadLocationEnabled) {
      if (!dbObject.resources) {
        dbObject.resources = [];
      }
      studyFileLocation = this.getFilesPrefix(requestContext, id, rawStudyEntity.category);
      dbObject.resources.push({ arn: `arn:aws:s3:::${this.studyDataBucket}/${studyFileLocation}` });
    }

    // Time to save the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // Error if already exists
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`study with id "${id}" already exists`, true);
      },
    );

    // Call study permissions service to create the necessary entities
    const studyEntity = toStudyEntity(result);
    if (!isOpenData(studyEntity)) {
      const studyPermissionEntity = await studyPermissionService.create(requestContext, studyEntity, {
        adminUsers: [by],
      });
      studyEntity.permissions = studyPermissionEntity;
    }

    // Create a zero-byte object for the study in the study bucket if requested
    if (rawStudyEntity.uploadLocationEnabled) {
      await this.s3Client
        .putObject({
          Bucket: this.studyDataBucket,
          Key: studyFileLocation,
          // ServerSideEncryption: 'aws:kms', // Not required as S3 bucket has default encryption specified
          Tagging: `projectId=${rawStudyEntity.projectId}`,
        })
        .promise();
    }

    // Write audit event
    await this.audit(requestContext, { action: 'create-study', body: studyEntity });

    return studyEntity;
  }

  async updatePermissions(requestContext, studyId, updateRequest) {
    // Ensure the principal has update permission. This is done by getting the study permissions entity
    // and checking if the principal has a study admin permissions
    const studyEntity = await this.find(requestContext, studyId);
    if (isOpenData(studyEntity)) {
      throw this.boom.forbidden('Permissions cannot be set for studies in the "Open Data" category', true);
    }

    if (isMyStudies(studyEntity)) {
      throw this.boom.forbidden('Permissions cannot be set for studies in the "My Studies" category', true);
    }

    const [studyPermissionService] = await this.service(['studyPermissionService']);

    const studyPermissionsEntity = await studyPermissionService.update(requestContext, studyEntity, updateRequest);
    return { ...studyEntity, permissions: studyPermissionsEntity };
  }

  async update(requestContext, rawData) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    if (!_.isEmpty(rawData.appRoleArn) && !isAdmin(requestContext)) {
      throw this.boom.forbidden("You don't have permissions to update the application role arn", true);
    }

    // Validate input
    await validationService.ensureValid(rawData, updateSchema);
    const { id } = rawData;
    const by = _.get(requestContext, 'principalIdentifier.uid');

    // Ensure the principal has update permission. This is done by getting the study permissions entity
    // and checking if the principal has a study admin permissions
    const studyEntity = await this.getStudyPermissions(requestContext, id);
    if (!isStudyAdmin(studyEntity.permissions, by) && !isAdmin(requestContext)) {
      throw this.boom.forbidden("You don't have permissions to update this study", true);
    }

    if (isOpenData(studyEntity) && !isSystem(requestContext)) {
      throw this.boom.badRequest('Only the system can update Open Data studies.', true);
    }

    if (!isOpenData(studyEntity) && !_.isEmpty(rawData.resources)) {
      throw this.boom.badRequest('Resources can only be updated for Open Data study category', true);
    }

    // Prepare the db object
    const dbObject = _.omit(toDbEntity(rawData, { updatedBy: by }), ['rev']);

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        // We are in this section because the call to DynamoDB threw the
        // an exception with code ConditionalCheckFailedException. In this specific
        // case, because the rev condition failed, indicated that we were trying to update
        // a stale record.
        throw this.boom.outdatedUpdateAttempt(
          `study information changed just before your request is processed, please try again`,
          true,
        );
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-study', body: result });

    return result;
  }

  /**
   * Call this method to update the status of the study entity.
   *
   * @param requestContext The standard requestContext
   * @param studyEntity The study entity
   * @param status The status to change to. Can be 'pending', 'error' or 'reachable'
   * @param statusMsg The status message to use. Do not provide it if you don't want to
   * change the existing message. Provide an empty string value if you want to clear
   * the existing message. Otherwise, the message you provide will replace the existing
   * message.
   */
  async updateStatus(requestContext, studyEntity, { status, statusMsg } = {}) {
    if (!isAdmin(requestContext)) {
      throw this.boom.forbidden("You don't have permissions to update the status", true);
    }

    if (!_.includes(['pending', 'error', 'reachable'], status)) {
      throw this.boom.badRequest(`A status of '${status}' is not allowed`, true);
    }

    const { id } = studyEntity;
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const removeStatus = status === 'reachable' || _.isEmpty(status);
    const removeMsg = _.isString(statusMsg) && _.isEmpty(statusMsg);

    const item = { updatedBy: by, statusAt: new Date().toISOString() };

    // Remember that we use the 'status' attribute in the index and we need to ensure
    // that when status == reachable that we remove the status attribute from the database
    if (!_.isEmpty(statusMsg)) item.statusMsg = statusMsg;
    if (!removeStatus) item.status = status;

    const dbEntity = await runAndCatch(
      async () => {
        let op = this._updater()
          .condition('attribute_exists(id)')
          .key({ id: studyEntity.id });

        if (removeMsg) op = op.remove('statusMsg');
        if (removeStatus) op = op.names({ '#status': 'status' }).remove('#status');

        return op.item(item).update();
      },
      async () => {
        throw this.boom.notFound(`The study entity "${id}" does not exist`, true);
      },
    );

    return toStudyEntity(dbEntity);
  }

  async list(requestContext, category, fields = []) {
    // Get studies allowed for user
    let result = [];
    switch (category) {
      case 'Open Data':
        // Readable by all
        result = await this._query()
          .index(this.categoryIndex)
          .key('category', category)
          .limit(1000)
          .projection(fields)
          .query();
        break;

      default: {
        // Generate results based on access
        const uid = _.get(requestContext, 'principalIdentifier.uid');
        const userPermissions = await this.getUserPermissions(requestContext, uid);
        const studyIds = getStudyIds(userPermissions);
        if (!_.isEmpty(studyIds)) {
          // TODO - currently, DynamoDB will throw an exception if the number of
          // items in the batch get > 100
          const rawResult = await this._getter()
            .keys(studyIds.map(studyId => ({ id: studyId })))
            .projection(fields)
            .get();

          // Filter by category and inject requestor's access level
          const studyAccessMap = this._getStudyAccessMap(userPermissions);

          result = rawResult
            .filter(study => study.category === category)
            .map(study => ({
              ...study,
              access: studyAccessMap[study.id],
            }));
        }
      }
    }

    // Return result
    return _.map(result, toStudyEntity);
  }

  async listStudiesForAccount(requestContext, { accountId }, fields = []) {
    if (!isAdmin(requestContext)) {
      throw this.boom.forbidden("You don't have permissions to call this method", true);
    }

    const result = await this._query()
      .index(this.accountIdIndex)
      .key('accountId', accountId)
      .limit(4000)
      .projection(fields)
      .query();

    return _.map(result, toStudyEntity);
  }

  /**
   * Given a folder, search all existing studies in the given account and bucket and determine if this new folder
   * is overlapping with existing ones. Overlapping means that the new folder is the direct parent or the ancestor parent
   * of any of the existing studies folders in the same account and bucket. In addition, this applies the other way around.
   * If an existing study folder is the parent or an ancestor parent of the new folder then there is an overlap.
   *
   * @param requestContext The standard request context
   * @param accountId The account id
   * @param bucketName The bucket name
   * @param folder The folder
   */
  async isOverlapping(requestContext, accountId, bucketName, folder) {
    // All studies for the account
    const allStudies = await this.listStudiesForAccount(requestContext, { accountId });

    // Studies that are part of the given bucket
    const studies = _.filter(allStudies, study => study.bucket === bucketName);

    const normalizedFolder = normalizeStudyFolder(folder);

    // Lets test for the case of the root folder. If the normalized folder is the root folder and we already have
    // existing studies, then this is an overlap already
    if (normalizedFolder === '/' && !_.isEmpty(studies)) return true;

    const overlap = _.some(studies, study => {
      // Do we have a root folder? if so, then any other attempt in registering studies for this bucket should
      // result in an overlap
      if (study.folder === '/') return true;

      return _.startsWith(normalizedFolder, study.folder) || _.startsWith(study.folder, normalizedFolder);
    });

    return overlap;
  }

  _getStudyAccessMap(userPermissions) {
    const studyAccessMap = {};
    _.forEach(permissionLevels, level => {
      const studies = userPermissions[`${level}Access`];
      _.forEach(studies, studyId => {
        if (studyAccessMap[studyId]) {
          studyAccessMap[studyId].push(level);
        } else {
          studyAccessMap[studyId] = [level];
        }
      });
    });
    return studyAccessMap;
  }

  /**
   * Creates a presigned post URL and form fields for use in uploading objects to S3 from the browser.
   * Note: In order for browser uplaod to work, the destination bucket will need to have an appropriate CORS policy configured.
   * @see https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutBucketCors.html
   *
   * @param {Object} requestContext the request context provided by @aws-ee/base-services-container/lib/request-context
   * @param {string} studyId the ID of the study in which the uploaded files should be shored.
   * @param {string} filenames the filenames that will be used for the upload.
   * @param {CreatePresignedPostOptions} options additional options.
   *
   * @typedef {Object} CreatePresignedPostOptions
   * @property {boolean} [multiPart] set to true to allow multipart uploading.
   *
   * @returns {Promise<AWS.S3.PresignedPost>} the url and fields to use when performing the upload
   */
  async createPresignedPostRequests(requestContext, studyId, filenames, encrypt = true, multiPart = true) {
    // Get study details and check permissions
    const uid = _.get(requestContext, 'principalIdentifier.uid');

    const studyEntity = await this.getStudyPermissions(requestContext, studyId);
    if (!_.isUndefined(studyEntity.bucket))
      throw this.boom.forbidden('Currently presigned post requests can only be performed for internal studies', true);

    const { admin, write } = accessLevels(studyEntity, uid);

    if (!write && !admin) throw this.boom.forbidden("You don't have permission to perform this operation", true);

    // Loop through requested files and generate presigned POST requests
    const prefix = this.getFilesPrefix(requestContext, studyEntity.id, studyEntity.category);
    return Promise.all(
      filenames.map(filename => {
        // Prep request
        /** @type {AWS.S3.PresignedPost.Params} */
        const params = { Bucket: this.studyDataBucket, Fields: { key: `${prefix}${filename}` } };
        if (multiPart) {
          params.Fields.enctype = 'multipart/form-data';
        }
        if (encrypt) {
          // Nothing to do here because the S3 bucket has default encryption specified and has policy that denies any
          // uploads not using default encryption
          // If S3 bucket did not enforce default encryption using aws:kms then we must specify
          // 'x-amz-server-side-encryption' and 'x-amz-server-side-encryption-aws-kms-key-id' here as follows
          //
          // params.Fields['x-amz-server-side-encryption'] = 'aws:kms';
          // Specify the KMS Key ID here for encryption
          // https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html
          // params.Fields['x-amz-server-side-encryption-aws-kms-key-id'] = arn of the StudyDataEncryptionKey
        }
        params.Fields.tagging = buildTaggingXml({
          uploadedBy: requestContext.principal.username,
          projectId: studyEntity.projectId,
        });

        // s3.createPresignedPost does not expose a `.promise()` method like other AWS SDK APIs.
        // Since we want to expose the operation as an asynchronous operation, we have to manually wrap it in a Promise.
        return new Promise((resolve, reject) =>
          this.s3Client.createPresignedPost(params, (err, data) => {
            if (err) {
              return reject(err);
            }
            return resolve(data);
          }),
        );
      }),
    ).then(requests =>
      requests.reduce(
        (allRequests, currRequest, currIdx) => ({
          // Convert presigned request data to an object key -> data map
          ...allRequests,
          [filenames[currIdx]]: currRequest,
        }),
        {},
      ),
    );
  }

  async listFiles(requestContext, studyId) {
    // TODO: Add pagination
    const studyEntity = await this.getStudyPermissions(requestContext, studyId);
    const prefix = await this.getFilesPrefix(requestContext, studyId, studyEntity.category);
    const params = {
      Bucket: this.studyDataBucket,
      Prefix: prefix,
    };

    // Return results, removing zero-byte prefix object and only including certain fields
    return (await this.s3Client.listObjectsV2(params).promise()).Contents.filter(object => object.Key !== prefix).map(
      object => ({
        filename: object.Key.slice(prefix.length),
        size: object.Size,
        lastModified: object.LastModified,
      }),
    );
  }

  /**
   * Private Methods
   */
  getFilesPrefix(requestContext, studyId, studyCategory) {
    if (studyCategory === 'My Studies') {
      return `users/${requestContext.principal.username}/${studyId}/`;
    }
    return `studies/${studyCategory}/${studyId}/`;
  }

  notFoundError(studyId) {
    return this.boom.notFound(`Study with id "${studyId}" does not exist`, true);
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = StudyService;
