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

/* eslint-disable no-await-in-loop */
const _ = require('lodash');
const Service = require('@amzn/base-services-container/lib/service');
const { ensureAdmin } = require('@amzn/base-services/lib/authorization/assertions');
const { toVersionString, parseVersionString, runAndCatch } = require('@amzn/base-services/lib/helpers/utils');

const inputSchema = require('../schema/workflow-template');

const settingKeys = {
  tableName: 'dbWorkflowTemplates',
};

// Do some properties renaming to prepare the object to be saved in the database
function toDbObject(dataObject) {
  const result = { ...dataObject };

  delete result.ver;
  delete result.createdAt;
  delete result.createdBy;
  delete result.updatedAt;
  delete result.updatedBy;
  delete result.rev;

  return result;
}

// Do some properties renaming to restore the object that was saved in the database
function toDataObject(dbObject) {
  if (_.isNil(dbObject)) return dbObject;
  if (!_.isObject(dbObject)) return dbObject;

  const result = { ...dbObject };
  result.v = result.latest ? result.latest : parseVersionString(dbObject.ver);

  delete result.ver;
  delete result.latest;

  return result;
}

// Go through the object own props and if they are empty strings, remove the props
function removeEmptyStrings(srcObject) {
  const result = {};

  Object.keys(srcObject).forEach(key => {
    const value = srcObject[key];
    if (_.isString(value) && _.isEmpty(value)) return;
    result[key] = value;
  });

  return result;
}

class WorkflowTemplateService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'stepTemplateService', 'dbService', 'auditWriterService']);
  }

  async init() {
    await super.init();
    this.tableName = this.settings.get(settingKeys.tableName);
  }

  async createVersion(requestContext, manifest = {}, { isLatest = true, tableName } = {}) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);

    await ensureAdmin(requestContext);
    manifest = this.applyDefaults(manifest);
    // Validate input
    await jsonSchemaValidationService.ensureValid(manifest, inputSchema);

    const dbService = await this.service('dbService');
    const table = tableName || this.tableName;
    const { id, v } = manifest;
    const logPrefix = `The workflow template "${id}" with ver "${v}" and rev "0"`;

    manifest = await this.populateSteps(manifest);
    const dbObject = toDbObject(manifest);

    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');

    // TODO - we need to wrap the creation of the version and the update of the latest record in a transaction
    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_not_exists(ver)')
          .key({ id, ver: toVersionString(v) })
          .item({ ...dbObject, rev: 0, createdBy: by, updatedBy: by })
          .update();
      },
      async () => {
        throw this.boom.badRequest(`${logPrefix} already exist`, true);
      },
    );

    if (isLatest) {
      // Note that this is not the typical versioning technique. This is because in this case the caller of this
      // method already wants to update a specific version which might not be the latest version
      await runAndCatch(
        async () => {
          return dbService.helper
            .updater()
            .table(table)
            .updatedAt(result.updatedAt)
            .disableCreatedAt()
            .key({ id, ver: toVersionString(0) })
            .condition('(attribute_exists(id) and #latest <= :latest) or attribute_not_exists(id)')
            .item({ ...result, latest: v })
            .names({ '#latest': 'latest' })
            .values({ ':latest': v })
            .update();
        },
        async () => {
          // we ignore the ConditionalCheckFailedException exception because it simply means that the created version is not the
          // latest version anymore and there is no need to bother the caller of this fact
        },
      );
    }
    const dataResult = toDataObject(result);

    // Write audit event
    await this.audit(requestContext, { action: 'create-workflow-template-version', body: dataResult });

    return dataResult;
  }

  async updateVersion(requestContext, manifest = {}, { isLatest = true, tableName } = {}) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);

    await ensureAdmin(requestContext);
    manifest = this.applyDefaults(manifest);

    // Validate input
    // we need to remove 'rev' here because the schema does not allow it, we should have a schema
    // that allows 'rev' but for now, we don't do that.
    await jsonSchemaValidationService.ensureValid(_.omit(manifest, ['rev']), inputSchema);
    // now we need to check that rev is supplied
    if (_.isNil(manifest.rev))
      throw this.boom.badRequest('The supplied workflow template does not have the "rev" property', true);

    const dbService = await this.service('dbService');
    const table = tableName || this.tableName;
    const { id, v, rev } = manifest;
    const logPrefix = `The workflow template "${id}" with ver "${v}" and rev "${rev}"`;

    manifest = await this.populateSteps(manifest);
    const dbObject = toDbObject(manifest);

    // For now, we assume that updatedBy' is always a user and not a group
    const by = _.get(requestContext, 'principalIdentifier.uid');

    // TODO: we need to wrap the creation of the version and the update of the latest record in a transaction
    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_exists(ver)')
          .key({ id, ver: toVersionString(v) })
          .rev(rev)
          .item({ ...dbObject, updatedBy: by })
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The "v" entry does not exist
        // 2 - The "rev" does not match
        const existing = await this.findVersion({ id, v, fields: ['id', 'v', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `${logPrefix} information changed by "${existing.updatedBy}" just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.badRequest(`${logPrefix} does not exist`, true);
      },
    );

    if (isLatest) {
      // Note that this is not the typical versioning technique. This is because in this case the caller of this
      // method already wants to update a specific version which might not be the latest version
      await runAndCatch(
        async () => {
          return dbService.helper
            .updater()
            .table(table)
            .updatedAt(result.updatedAt)
            .key({ id, ver: toVersionString(0) })
            .condition('#latest = :latest')
            .item(result)
            .names({ '#latest': 'latest' })
            .values({ ':latest': v })
            .update();
        },
        async () => {
          // we ignore the ConditionalCheckFailedException exception because it simply means that the updated version is not the
          // latest version anymore and there is no need to bother the caller of this fact
        },
      );
    }

    const dataResult = toDataObject(result);

    // Write audit event
    await this.audit(requestContext, { action: 'update-workflow-template-version', body: dataResult });

    return dataResult;
  }

  // List all versions for all workflow templates or for a specific workflow template if the workflow template id was provided
  async listVersions({ id, fields = [] } = {}) {
    const dbService = await this.service('dbService');
    const table = this.tableName;

    if (_.isNil(id)) {
      // The scanner route
      const result = await dbService.helper
        .scanner()
        .table(table)
        .filter('attribute_not_exists(latest)') // we don't want to return the v0000_ one
        .limit(2000)
        .projection(fields)
        .scan();
      return _.map(result, item => toDataObject(item));
    }

    const result = await dbService.helper
      .query()
      .table(table)
      .key('id', id)
      .forward(false)
      .filter('attribute_not_exists(latest)') // we don't want to return the v0000_ one
      .limit(2000)
      .projection(fields)
      .query();
    const versions = _.map(result, item => toDataObject(item));
    if (versions.length === 0) throw this.boom.notFound(`The workflow template "${id}" is not found`, true);

    return versions;
  }

  // List latest versions of all the workflow templates
  async list({ fields = [] } = {}) {
    const dbService = await this.service('dbService');
    const table = this.tableName;

    // The scanner route
    const result = await dbService.helper
      .scanner()
      .table(table)
      .filter('attribute_exists(latest)')
      .limit(2000)
      .projection(fields)
      .scan();
    return _.map(result, item => toDataObject(item));
  }

  async findVersion({ id, v = 0, fields = [] }, { tableName } = {}) {
    const dbService = await this.service('dbService');
    // This function can accept a different tableName to use for the lookup, this is useful in places
    // such as post deployment
    const table = tableName || this.tableName;

    const result = await dbService.helper
      .getter()
      .table(table)
      .key({ id, ver: toVersionString(v) })
      .projection(fields)
      .get();

    return toDataObject(result);
  }

  async mustFindVersion({ id, v = 0, fields }) {
    const workflowTemplate = await this.findVersion({ id, v, fields });
    if (!workflowTemplate) throw this.boom.notFound(`The workflow template "${id}" ver "${v}" is not found`, true);
    return workflowTemplate;
  }

  applyDefaults(manifest) {
    return {
      runSpec: {
        target: 'stepFunctions',
        size: 'small',
      },
      ...manifest,
    };
  }

  // This method mutates the manifest selected steps by populating the stepTemplate prop for each step
  async populateSteps(manifest) {
    const [stepTemplateService] = await this.service(['stepTemplateService']);
    const idMap = {};
    let index = 0;

    // Get all the step templates
    /* eslint-disable no-restricted-syntax */
    for (const step of manifest.selectedSteps) {
      const { stepTemplateId, stepTemplateVer } = step;
      const stepTemplate = await stepTemplateService.mustFindVersion({ id: stepTemplateId, v: stepTemplateVer });

      step.stepTemplate = stepTemplate;

      if (idMap[step.id]) {
        throw this.boom.badRequest(
          `Step at index [${index}] has the same id "${step.id}" as a previous step. Step ids must be unique within the workflow`,
          true,
        );
      }
      /* eslint-enable no-restricted-syntax */

      idMap[step.id] = true;
      index += 1;
      if (!_.isUndefined(step.defaults)) {
        step.defaults = removeEmptyStrings(step.defaults); // This is because you won't be able to update an existing value in the database with a new value that is an empty string
      }
    }

    return manifest;
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

module.exports = WorkflowTemplateService;
