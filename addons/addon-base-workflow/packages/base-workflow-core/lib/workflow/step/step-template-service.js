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
const Service = require('@amzn/base-services-container/lib/service');
const { ensureAdmin } = require('@amzn/base-services/lib/authorization/assertions');

const { toVersionString, parseVersionString, runAndCatch } = require('@amzn/base-services/lib/helpers/utils');
const inputSchema = require('../../schema/step-template');

const settingKeys = {
  tableName: 'dbStepTemplates',
};

class StepTemplateService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'dbService', 'inputManifestValidationService']);
  }

  async init() {
    await super.init();
    this.tableName = this.settings.get(settingKeys.tableName);
  }

  async createVersion(requestContext, manifest = {}, { isLatest = true, tableName } = {}) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);

    await ensureAdmin(requestContext);

    // TODO - validation does not check for additional props that are not supported, we need to fix it
    //        unfortunately, it is not a matter of adding 'additionalProperties' false, because this does
    //        not work with 'oneOf' option in json schema (possible bug in json schema)
    // Validate input
    await jsonSchemaValidationService.ensureValid(manifest, inputSchema);

    const dbService = await this.service('dbService');
    const table = tableName || this.tableName;
    const { id, v } = manifest;
    const logPrefix = `The step template "${id}" with ver "${v}" and rev "0"`;
    const dbObject = toDbObject(manifest);

    // TODO - we need to wrap the creation of the version and the update of the latest record in a transaction
    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_not_exists(ver)') // yes we need this
          .key({ id, ver: toVersionString(v) })
          .item({ ...dbObject, rev: 0 })
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
    return toDataObject(result);
  }

  async updateVersion(requestContext, manifest = {}, { isLatest = true, tableName } = {}) {
    const [jsonSchemaValidationService] = await this.service(['jsonSchemaValidationService']);

    await ensureAdmin(requestContext);

    // Validate input

    // we need to remove 'rev' here because the schema does not allow it, we should have a schema
    // that allows 'rev' but for now, we don't do that.
    await jsonSchemaValidationService.ensureValid(_.omit(manifest, ['rev']), inputSchema);
    // now we need to check that rev is supplied
    if (_.isNil(manifest.rev))
      throw this.boom.badRequest('The supplied step template does not have the "rev" property', true);

    const dbService = await this.service('dbService');
    const table = tableName || this.tableName;
    const { id, v, rev } = manifest;
    const logPrefix = `The step template "${id}" with ver "${v}" and rev "${rev}"`;
    const dbObject = toDbObject(manifest);

    // lets keep track of what we need to remove
    const remove = [];
    if (manifest.inputManifest === undefined) remove.push('inputManifest');
    if (manifest.adminInputManifest === undefined) remove.push('adminInputManifest');

    // TODO - we need to wrap the creation of the version and the update of the latest record in a transaction
    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_exists(ver)') // yes we need this
          .key({ id, ver: toVersionString(v) })
          .rev(rev)
          .remove(remove)
          .item(dbObject)
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The "v" entry does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.findVersion({ id, v, fields: ['id', 'v'] });
        if (existing) {
          throw this.boom.badRequest(
            `${logPrefix} information changed just before your request is processed, please try again`,
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
            .remove(remove)
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

    return toDataObject(result);
  }

  // List all versions for all step templates or for a specific step template if the step template id was provided
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
    return _.map(result, item => toDataObject(item));
  }

  // List latest versions of all the step templates
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
    const step = await this.findVersion({ id, v, fields });
    if (!step) throw this.boom.notFound(`The step template "${id}" ver "${v}" is not found`, true);
    return step;
  }

  async mustValidateVersion({ id, v = 0, config = {} }) {
    const [inputManifestValidationService] = await this.service(['inputManifestValidationService']);
    const step = await this.mustFindVersion({ id, v });
    const { inputManifest = {} } = step;
    const validationErrors = await inputManifestValidationService.getValidationErrors(inputManifest, config);
    return { validationErrors };
  }
}

// Do some properties renaming to prepare the object to be saved in the database
function toDbObject(dataObject) {
  const result = { ...dataObject };

  delete result.ver;
  delete result.createdAt;
  delete result.updatedAt;
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

module.exports = StepTemplateService;
