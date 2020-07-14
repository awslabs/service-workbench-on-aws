const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { isAllow, allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const { getServiceCatalogClient } = require('./helpers/env-type-service-catalog-helper');
const envTypeStatusEnum = require('./helpers/env-type-status-enum');
const createEnvTypeSchema = require('./schema/create-env-type');
const updateEnvTypeSchema = require('./schema/update-env-type');

const settingKeys = {
  tableName: 'dbTableEnvironmentTypes',
  envMgmtRoleArn: 'envMgmtRoleArn',
};
const emptyObjectIfDoesNotExist = e => {
  if (e.code === 'NoSuchEntity' || e.code === 'ResourceNotFoundException') {
    return {}; // return empty object if the entity does not exists
  }
  throw e; // for any other error let it bubble up
};
/**
 * The environment type management service
 */
class EnvTypeService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'jsonSchemaValidationService', 'dbService', 'authorizationService', 'auditWriterService']);
  }

  async init() {
    await super.init();
    const [dbService] = await this.service(['dbService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);
  }

  /**
   * Returns list of environment types with the specified fields matching the specified filter criteria.
   * Returns only approved environment types available for launching
   *
   * @param requestContext
   * @param fields
   * @param filter
   * @returns {Promise<void>}
   */
  // LIMITATION: DOES NOT SUPPORT MORE THAN 3000 ENVIRONMENT TYPES
  async list(requestContext, { fields = [], filter = { status: [envTypeStatusEnum.approved] } } = {}) {
    // ensure that the caller has permissions to list environment types
    // Perform default condition checks to make sure the user is active
    await this.assertAuthorized(requestContext, { action: 'list', conditions: [allowIfActive] });

    const filterStatuses = filter.status || [envTypeStatusEnum.approved];

    // Validate filter
    const invalidFilterStatuses = _.filter(filterStatuses, s => !envTypeStatusEnum.isValidStatus(s));
    if (!_.isEmpty(invalidFilterStatuses)) {
      throw this.boom.badRequest(
        `Invalid status specified for filter. Valid values for status are ${_.join(
          envTypeStatusEnum.getValidStatuses(),
        )}`,
        true,
      );
    }

    const includeAll = _.includes(filterStatuses, '*');
    const includeNotApproved = _.includes(filterStatuses, envTypeStatusEnum.notApproved) || includeAll;
    const includeApproved = _.includes(filterStatuses, envTypeStatusEnum.approved) || includeAll;

    // Remember doing a scanning is not a good idea if you have millions of records
    const envTypes = await this._scanner()
      .limit(3000)
      .projection(fields)
      .scan();

    // Check if the caller has permissions to list not-approved environment types
    // Perform default condition checks to make sure the user is active and is admin
    const allowedToListNotApproved = await this.isAuthorized(requestContext, {
      action: 'list-not-approved',
      conditions: [allowIfActive, allowIfAdmin],
    });
    if (includeAll && allowedToListNotApproved) {
      // if asked to return all env types then no need to do any further filtering
      // return all env types
      return envTypes;
    }

    // Code reached here, means we may need to filter
    let result = [];
    if (includeNotApproved && allowedToListNotApproved) {
      const notApprovedEnvTypes = _.filter(envTypes, envType => envTypeStatusEnum.isNotApproved(envType.status));
      result = [...result, ...notApprovedEnvTypes];
    }
    if (includeApproved) {
      const approvedEnvTypes = _.filter(envTypes, envType => envTypeStatusEnum.isApproved(envType.status));
      result = [...result, ...approvedEnvTypes];
    }
    return result;
  }

  async find(requestContext, { id, fields = [] }) {
    // Make sure the user has permissions to read the environment type
    // By default, allow "read" only to active users
    await this.assertAuthorized(requestContext, { action: 'read', conditions: [allowIfActive] });

    const envType = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    if (envType && envTypeStatusEnum.isNotApproved(envType.status)) {
      // Make sure the caller has permissions to read not-approved environment type
      // Perform default condition checks to make sure the user is active and is admin
      await this.assertAuthorized(requestContext, {
        action: 'read-not-approved',
        conditions: [allowIfActive, allowIfAdmin],
      });
    }

    return this._fromDbToDataObject(envType);
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`environment type with id "${id}" does not exist`, true);
    return result;
  }

  async getProvisioningArtifactParams(requestContext, productId, provisioningArtifactId) {
    const [aws] = await this.service(['aws']);
    const roleArn = this.settings.get(settingKeys.envMgmtRoleArn);
    const serviceCatalogClient = await getServiceCatalogClient(aws, roleArn);

    // Make sure there is only one and only one launch path for the product being imported
    const result = await serviceCatalogClient
      .listLaunchPaths({ ProductId: productId })
      .promise()
      .catch(emptyObjectIfDoesNotExist);
    // expecting the product to be available to the platform via exactly
    // one portfolio i.e., it needs to have exactly one launch path
    if (_.isEmpty(result.LaunchPathSummaries)) {
      throw this.boom.internalError(
        `The product ${productId} is not shared with the ${roleArn} role. Please add the role "${roleArn}" to the AWS Service Catalog Portfolio and try again.`,
        true,
      );
    }
    if (result.LaunchPathSummaries.length > 1) {
      throw this.boom.internalError(
        `The product ${productId} is shared via multiple portfolios, do not know which portfolio to launch from. Please make sure the product is shared to ${roleArn} via only one portfolio.`,
        true,
      );
    }

    const launchPathId = result.LaunchPathSummaries[0].Id;

    const provisioningParams = await serviceCatalogClient
      .describeProvisioningParameters({
        ProductId: productId,
        ProvisioningArtifactId: provisioningArtifactId,
        PathId: launchPathId,
      })
      .promise()
      .catch(emptyObjectIfDoesNotExist);

    if (_.isEmpty(provisioningParams)) {
      throw this.boom.internalError(
        `Could not read provisioning information for product ${productId} and provisioning artifact ${provisioningArtifactId}.` +
          `Please add the role "${roleArn}" to the AWS Service Catalog Portfolio and try again.`,
      );
    }

    const constraints = provisioningParams.ConstraintSummaries || [];
    const launchConstraint = _.find(constraints, { Type: 'LAUNCH' });
    if (_.isEmpty(launchConstraint)) {
      throw this.boom.internalError(
        `The product ${productId} does not have any launch constraint role specified. Please specify a local role name as launch constraint and try again`,
        true,
      );
    }

    return provisioningParams.ProvisioningArtifactParameters;
  }

  async create(requestContext, environmentType) {
    // Make sure the user has permissions to create the environment type
    await this.assertAuthorized(
      requestContext,
      { action: 'create', conditions: [allowIfActive, allowIfAdmin] },
      environmentType,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(environmentType, createEnvTypeSchema);

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    const { id } = environmentType;

    environmentType.params = await this.getProvisioningArtifactParams(
      requestContext,
      environmentType.product.productId,
      environmentType.provisioningArtifact.id,
    );

    // Prepare the db object
    const dbObject = this._fromRawToDbObject(environmentType, { rev: 0, createdBy: by, updatedBy: by });

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // make sure we fail if record with same id already exists
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`Workspace type with id "${id}" already exists`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'create-environment-type', body: result });

    return result;
  }

  async update(requestContext, environmentType) {
    // ensure that the caller has permissions to update the environmentType information
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [allowIfActive, allowIfAdmin] },
      environmentType,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(environmentType, updateEnvTypeSchema);

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    const { id, rev } = environmentType;

    // Prepare the db object
    const dbObject = _.omit(this._fromRawToDbObject(environmentType, { updatedBy: by }), ['rev']);

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // make sure the record being updated exists
          .key({ id })
          .rev(rev)
          .item(dbObject)
          .update();
      },
      async () => {
        // There are two scenarios here:
        // 1 - The environmentType does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.find(requestContext, { id, fields: ['id', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `environmentType information changed by "${
              (existing.updatedBy || {}).username
            }" just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`environmentType with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-environment-type', body: result });

    return result;
  }

  async delete(requestContext, { id }) {
    // ensure that the caller has permissions to delete the environmentType
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'delete', conditions: [allowIfActive, allowIfAdmin] },
      { id },
    );

    // Lets now remove the item from the database
    await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(id)') // make sure the record being deleted exists
          .key({ id })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`environmentType with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'delete-environment-type', body: { id } });
  }

  async approve(requestContext, { id, rev }) {
    return this.update(requestContext, { id, status: envTypeStatusEnum.approved, rev });
  }

  async revoke(requestContext, { id, rev }) {
    return this.update(requestContext, { id, status: envTypeStatusEnum.notApproved, rev });
  }

  // Do some properties renaming to prepare the object to be saved in the database
  _fromRawToDbObject(rawObject, overridingProps = {}) {
    const dbObject = { ...rawObject, ...overridingProps };
    return dbObject;
  }

  // Do some properties renaming to restore the object that was saved in the database
  _fromDbToDataObject(rawDb, overridingProps = {}) {
    if (_.isNil(rawDb)) return rawDb; // important, leave this if statement here, otherwise, your update methods won't work correctly
    if (!_.isObject(rawDb)) return rawDb;

    const dataObject = { ...rawDb, ...overridingProps };
    return dataObject;
  }

  async isAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.authorize" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    return isAllow(
      await authorizationService.authorize(
        requestContext,
        { extensionPoint: 'env-type-authz', action, conditions },
        ...args,
      ),
    );
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'env-type-authz', action, conditions },
      ...args,
    );
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
module.exports = EnvTypeService;
