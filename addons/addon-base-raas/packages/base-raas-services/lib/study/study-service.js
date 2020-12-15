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
const createSchema = require('../schema/create-study');
const updateSchema = require('../schema/update-study');

const settingKeys = {
  tableName: 'dbStudies',
  categoryIndexName: 'dbStudiesCategoryIndex',
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
    const [aws, dbService, studyPermissionService] = await this.service(['aws', 'dbService', 'studyPermissionService']);
    this.s3Client = new aws.sdk.S3();
    this.studyPermissionService = studyPermissionService;

    const table = this.settings.get(settingKeys.tableName);
    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);

    this.categoryIndex = this.settings.get(settingKeys.categoryIndexName);
    this.studyDataBucket = this.settings.get(settingKeys.studyDataBucketName);
  }

  /**
   * Public Methods
   */
  async find(requestContext, id, fields = []) {
    const result = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    return this.fromDbToDataObject(result);
  }

  async mustFind(requestContext, id, fields = []) {
    const result = await this.find(requestContext, id, fields);
    if (!result) throw this.notFoundError(id);
    return result;
  }

  async listByIds(requestContext, ids, fields = []) {
    const result = await this._getter()
      .keys(ids)
      .projection(fields)
      .get();

    return result.map(record => this.fromDbToDataObject(record));
  }

  async create(requestContext, rawData) {
    if (!(isInternalResearcher(requestContext) || isAdmin(requestContext))) {
      throw this.boom.forbidden('Only admin and internal researcher are authorized to create studies. ');
    }
    if (rawData.category === 'Open Data' && !isSystem(requestContext)) {
      throw this.boom.badRequest('Only the system can create Open Data studies.', true);
    }
    const [validationService, projectService] = await this.service(['jsonSchemaValidationService', 'projectService']);

    // Validate input
    await validationService.ensureValid(rawData, createSchema);

    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');

    // validate if study can be read/write
    this.validateStudyType(rawData.accessType, rawData.category);

    // The open data studies do not need to be associated to any project
    // for everything else make sure projectId is specified
    if (rawData.category !== 'Open Data') {
      const projectId = rawData.projectId;
      if (!projectId) {
        throw this.boom.badRequest('Missing required projectId', true);
      }
      // Verify user has access to the project the new study will be associated with
      if (!(await projectService.verifyUserProjectAssociation(by, projectId))) {
        throw this.boom.forbidden(`Not authorized to add study related to project "${projectId}"`, true);
      }
      await projectService.mustFind(requestContext, { id: rawData.projectId });
      // Verify user is not trying to create resources for non-Open data studies
      if (!_.isEmpty(rawData.resources)) {
        throw this.boom.badRequest('Resources can only be assigned to Open Data study category', true);
      }
    }

    const id = rawData.id;

    // Prepare the db object
    const dbObject = this.fromRawToDbObject(rawData, { rev: 0, createdBy: by, updatedBy: by });

    // Create file upload location if necessary
    let studyFileLocation;
    if (rawData.uploadLocationEnabled) {
      if (!dbObject.resources) {
        dbObject.resources = [];
      }
      studyFileLocation = this.getFilesPrefix(requestContext, id, rawData.category);
      dbObject.resources.push({ arn: `arn:aws:s3:::${this.studyDataBucket}/${studyFileLocation}` });
    }

    // Time to save the the db object
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

    // Create a zero-byte object for the study in the study bucket if requested
    if (rawData.uploadLocationEnabled) {
      await this.s3Client
        .putObject({
          Bucket: this.studyDataBucket,
          Key: studyFileLocation,
          // ServerSideEncryption: 'aws:kms', // Not required as S3 bucket has default encryption specified
          Tagging: `projectId=${rawData.projectId}`,
        })
        .promise();
    }

    // Write audit event
    await this.audit(requestContext, { action: 'create-study', body: result });

    return result;
  }

  async update(requestContext, rawData) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    if (rawData.category === 'Open Data' && !isSystem(requestContext)) {
      throw this.boom.badRequest('Only the system can update Open Data studies.', true);
    }

    if (rawData.category !== 'Open Data' && !_.isEmpty(rawData.resources)) {
      throw this.boom.badRequest('Resources can only be updated for Open Data study category', true);
    }

    // Validate input
    await validationService.ensureValid(rawData, updateSchema);

    // For now, we assume that 'updatedBy' is always a user and not a group
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { id, rev } = rawData;

    const study = await this.mustFind(requestContext, id);

    // validate if study can be read/write
    this.validateStudyType(rawData.accessType, study.category);

    // TODO: Add logic for the following when full write functionality is implemented:
    // 1. Permissions removal for Read/Write and Write if ReadWrite accessType switches to ReadOnly
    // 2. Workspace mounts to be corrected
    // 3. Deleting any additional resources created as part of the ReadWrite functionality

    // Prepare the db object
    const dbObject = _.omit(this.fromRawToDbObject(rawData, { updatedBy: by }), ['rev']);

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .rev(rev)
          .item(dbObject)
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The study does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.find(requestContext, id, ['id', 'updatedBy']);
        if (existing) {
          throw this.boom.badRequest(
            `study information changed just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`study with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-study', body: result });

    return result;
  }

  async delete(requestContext, id) {
    // Lets now remove the item from the database
    const result = await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`study with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'delete-study', body: { id } });

    return result;
  }

  getAllowedStudies(permissions = []) {
    const adminAccess = permissions.adminAccess || [];
    const readonlyAccess = permissions.readonlyAccess || [];
    const readwriteAccess = permissions.readwriteAccess || [];
    return _.uniq([...adminAccess, ...readonlyAccess, ...readwriteAccess]);
  }

  async list(requestContext, category, fields = []) {
    // Get studies allowed for user
    let result = [];
    switch (category) {
      case 'Open Data':
        // Readable by all
        result = this._query()
          .index(this.categoryIndex)
          .key('category', category)
          .limit(1000)
          .projection(fields)
          .query();
        break;

      default: {
        // Generate results based on access
        const permissions = await this.studyPermissionService.getRequestorPermissions(requestContext);
        if (permissions) {
          // We can't give duplicate keys to the batch get, so ensure that allowedStudies is unique
          const allowedStudies = this.getAllowedStudies(permissions);
          if (allowedStudies.length) {
            const rawResult = await this._getter()
              .keys(allowedStudies.map(studyId => ({ id: studyId })))
              .projection(fields)
              .get();

            // Filter by category and inject requestor's access level
            const studyAccessMap = this._getStudyAccessMap(permissions);

            result = rawResult
              .filter(study => study.category === category)
              .map(study => ({
                ...study,
                access: studyAccessMap[study.id],
              }));
          }
        }
      }
    }

    // Return result
    return result;
  }

  _getStudyAccessMap(permissions) {
    const studyAccessMap = {};
    _.forEach(['admin', 'readwrite', 'readonly'], level => {
      const studiesWithPermission = permissions[`${level}Access`];
      if (studiesWithPermission && studiesWithPermission.length > 0)
        studiesWithPermission.forEach(studyId => {
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
    // Get study details and check permissinos
    const study = await this.mustFind(requestContext, studyId);

    // Loop through requested files and generate presigned POST requests
    const prefix = this.getFilesPrefix(requestContext, study.id, study.category);
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
          projectId: study.projectId,
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
    const study = await this.mustFind(requestContext, studyId, ['category']);
    const prefix = await this.getFilesPrefix(requestContext, studyId, study.category);
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

  // Do some properties renaming to prepare the object to be saved in the database
  fromRawToDbObject(rawObject, overridingProps = {}) {
    const dbObject = { ...rawObject, ...overridingProps };
    return dbObject;
  }

  // Do some properties renaming to restore the object that was saved in the database
  fromDbToDataObject(rawDb, overridingProps = {}) {
    if (_.isNil(rawDb)) return rawDb; // important, leave this if statement here, otherwise, your update methods won't work correctly
    if (!_.isObject(rawDb)) return rawDb;

    const dataObject = { ...rawDb, ...overridingProps };
    return dataObject;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  // ensure that study accessType isn't read/write for Open Data category
  validateStudyType(accessType, studyCategory) {
    if (accessType === 'readwrite' && studyCategory === 'Open Data') {
      throw this.boom.badRequest('Open Data study cannot be read/write', true);
    }
  }
}

module.exports = StudyService;
