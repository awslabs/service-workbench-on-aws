const _ = require('lodash');
const { v4: uuid } = require('uuid');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { isAdmin, isCurrentUser } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const createSchema = require('../schema/create-environment-sc');
const updateSchema = require('../schema/update-environment-sc');
const environmentScStatus = require('./environent-sc-status-enum');

const settingKeys = {
  tableName: 'dbTableEnvironmentsSc',
};
const workflowIds = {
  create: 'wf-provision-environment-sc',
  delete: 'wf-terminate-environment-sc',
};

/**
 * Analytics environments management service for AWS Service Catalog based environments
 */
class EnvironmentScService extends Service {
  constructor() {
    super();
    this.dependency([
      'aws',
      'jsonSchemaValidationService',
      'dbService',
      'authorizationService',
      'environmentAuthzService',
      'auditWriterService',
      'workflowTriggerService',
      'projectService',
      'awsAccountsService',
      'indexesService',
    ]);
  }

  async init() {
    await super.init();
    const [dbService, environmentAuthzService] = await this.service(['dbService', 'environmentAuthzService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);

    // A private authorization condition function that just delegates to the environmentAuthzService
    this._allowAuthorized = (requestContext, { resource, action, effect, reason }, ...args) =>
      environmentAuthzService.authorize(requestContext, { resource, action, effect, reason }, ...args);
  }

  async list(requestContext) {
    // Make sure the user has permissions to "list" environments
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(requestContext, { action: 'list-sc', conditions: [this._allowAuthorized] });

    // TODO: Handle pagination and search for user's own environments directly instead of filtering here
    const envs = await this._scanner()
      .limit(1000)
      .scan()
      .then(environments => {
        if (isAdmin(requestContext)) {
          return environments;
        }
        return environments.filter(env => isCurrentUser(requestContext, env.createdBy));
      });

    return this.augmentWithConnectionInfo(requestContext, envs);
  }

  /**
   * Method to augment the given environment objects with connections information.
   *
   * The method expects the the given env objects to contain the "outputs" array containing CFN outputs in the following form
   * "outputs": [
   *   {
   *     "OutputKey": STRING,
   *     "OutputValue": STRING,
   *     "Description": STRING
   *   },
   * ]
   *
   * The method adds additional "connections" array to the given env objects with the shape
   * [{name: STRING,url: STRING,scheme: STRING,type: STRING,info: STRING}].
   *
   * The "connections" are derived based on the outputs as follows.
   * CFN outputs with the OutputKey having format "Connection<ConnectionAttrib>" or
   * "Connection<N><ConnectionAttrib>" are used for extracting connection information.
   * - If the environment has only one connection then it can have outputs with "Connection<ConnectionAttrib>" format.
   * - If it has multiple connections then it can have outputs with "Connection<N><ConnectionAttrib>" format.
   * For example, Connection1Name, Connection2Name, etc. The following Connection* outputs are expected
   *
   * The expected CFN output variables used for capturing connections related information are as follows:
   *
   * ConnectionName (or Connection<N>Name) - Provides name for connection
   *
   * ConnectionUrl (or Connection<N>Url) - Provides connection url, if available
   *
   * ConnectionScheme (or Connection<N>Scheme) - Provides connection protocol information such as http, https, jdbc, odbc etc
   *
   * ConnectionType (or Connection<N>Type) - Provides type of the connection such as "SageMaker", "EMR", "FOO", "BAR" etc
   *
   * ConnectionInfo (or Connection<N>Info) - Provides extra information required to form connection url.
   * For example, in case of ConnectionType = SageMaker, the ConnectionInfo should provide SageMaker notebook
   * instance name that can be used to form pre-signed SageMaker URL.
   *
   * @param envs
   * @returns {Promise<*>}
   */
  async augmentWithConnectionInfo(requestContext, envs) {
    if (!envs) {
      return envs;
    }
    _.forEach(envs, env => {
      const connectionsMap = {};
      _.forEach(env.outputs, output => {
        const regex = /Connection([0-9]+)?(.+)/;
        // Parse the output key
        //    'Connection1Name' => ["Connection1Name", "1", "Name"]
        //    'ConnectionName' => ["ConnectionName", undefined, "Name"]
        //    'some-output-not-matching' => null
        const parsedOutput = output.OutputKey.match(regex);
        if (parsedOutput && _.isArray(parsedOutput) && parsedOutput.length === 3) {
          const connectionIdx = parsedOutput[1] || 0;
          let connection = connectionsMap[connectionIdx];
          if (!connection) {
            connection = {};
          }
          connection[_.toLower(parsedOutput[2])] = output.OutputValue;
          connection.id = `id-${connectionIdx}`; // number to string
          connectionsMap[connectionIdx] = connection;
        }
      });

      env.connections = _.values(connectionsMap);
    });

    return envs;
  }

  async find(requestContext, { id, fields = [] }) {
    // Make sure 'createdBy' is always returned as that's required for authorizing the 'get' action
    // If empty "fields" is specified then it means the caller is asking for all fields. No need to append 'createdBy'
    // in that case.
    const fieldsToGet = _.isEmpty(fields) ? fields : _.uniq([...fields, 'createdBy']);
    const result = await this._getter()
      .key({ id })
      .projection(fieldsToGet)
      .get();

    if (result) {
      // ensure that the caller has permissions to retrieve the specified environment
      // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
      await this.assertAuthorized(requestContext, { action: 'get-sc', conditions: [this._allowAuthorized] }, result);
    }

    const env = this._fromDbToDataObject(result);
    const [toReturn] = await this.augmentWithConnectionInfo(requestContext, [env]);
    return toReturn;
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`environment with id "${id}" does not exist`, true);
    return result;
  }

  async create(requestContext, environment) {
    if (requestContext.principal.isExternalUser) {
      // Launching/Terminating external environments for AWS Service Catalog based environments is not supported currently
      throw this.boom.forbidden(
        `You are not authorized to create workspaces. Please contact your administrator.`,
        true,
      );
    }

    const [validationService, workflowTriggerService, projectService] = await this.service([
      'jsonSchemaValidationService',
      'workflowTriggerService',
      'projectService',
    ]);

    // Validate input
    await validationService.ensureValid(environment, createSchema);

    // Make sure the user has permissions to create the environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(
      requestContext,
      { action: 'create-sc', conditions: [this._allowAuthorized] },
      environment,
    );

    // const { name, envTypeId, envTypeConfigId, description, projectId, cidr, studyIds } = environment
    const { envTypeId, envTypeConfigId, projectId } = environment;

    // Lets find the index id, by looking at the project and then get the index id
    const { indexId } = await projectService.mustFind(requestContext, { id: projectId, fields: ['indexId'] });

    // Save environment to db and trigger the workflow
    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    // Generate environment ID
    const id = uuid();
    // Prepare the db object
    const date = new Date().toISOString();
    const dbObject = this._fromRawToDbObject(environment, {
      indexId,
      status: environment.status || environmentScStatus.PENDING,
      rev: 0,
      createdBy: by,
      updatedBy: by,
      createdAt: date,
      updatedAt: date,
    });
    const dbResult = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // yes we need this to ensure the environment does not exist already
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`environment with id "${id}" already exists`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'create-environment-sc', body: environment });

    try {
      // Trigger the workflow
      const meta = { workflowId: workflowIds.create };
      await workflowTriggerService.triggerWorkflow(requestContext, meta, {
        requestContext,
        envId: id,
        envTypeId,
        envTypeConfigId,
      });
    } catch (e) {
      const error = this.boom.internalError(`Error triggering ${workflowIds.create} workflow`).cause(e);
      this.log.error(error);
      // if workflow trigger failed then update environment record in db with failed status
      // first retrieve the revision number of the record we just created above
      const { rev } = await this.mustFind(requestContext, { id, fields: ['rev'] });
      await this.update(requestContext, { id, rev, status: environmentScStatus.FAILED });

      throw error;
    }

    return dbResult;
  }

  async update(requestContext, environment) {
    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(environment, updateSchema);

    // Retrieve the existing environment, this is required for authorization below
    const existingEnvironment = await this.mustFind(requestContext, { id: environment.id });

    // Make sure the user has permissions to create the environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(
      requestContext,
      { action: 'update-sc', conditions: [this._allowAuthorized] },
      existingEnvironment,
    );

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    const { id, rev } = environment;

    // Prepare the db object
    const dbObject = _.omit(this._fromRawToDbObject(environment, { updatedBy: by }), ['rev']);

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
        // 1 - The record does not exist
        // 2 - The "rev" does not match
        // We will display the appropriate error message accordingly
        const existing = await this.find(requestContext, { id, fields: ['id', 'updatedBy'] });
        if (existing) {
          throw this.boom.badRequest(
            `environment information changed by "${
              (existing.updatedBy || {}).username
            }" just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`environment with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-environment-sc', body: environment });

    return result;
  }

  async delete(requestContext, { id }) {
    if (requestContext.principal.isExternalUser) {
      // Launching/Terminating external environments for AWS Service Catalog based environments is not supported currently
      throw this.boom.forbidden(
        `You are not authorized to delete workspaces. Please contact your administrator.`,
        true,
      );
    }

    const existingEnvironment = await this.mustFind(requestContext, { id });

    // Make sure the user has permissions to delete the environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(
      requestContext,
      { action: 'delete-sc', conditions: [this._allowAuthorized] },
      existingEnvironment,
    );

    await this.update(requestContext, { id, rev: existingEnvironment.rev, status: environmentScStatus.TERMINATING });

    try {
      // Trigger the workflow
      const [workflowTriggerService] = await this.service(['workflowTriggerService']);
      const meta = { workflowId: workflowIds.delete };
      const { xAccEnvMgmtRoleArn, externalId } = await this.getEnvMgmtRoleInfoForIndex(
        requestContext,
        existingEnvironment.indexId,
      );
      await workflowTriggerService.triggerWorkflow(requestContext, meta, {
        requestContext,
        envId: id,
        envName: existingEnvironment.name,
        xAccEnvMgmtRoleArn,
        externalId,
        provisionedProductId: existingEnvironment.provisionedProductId,
      });
    } catch (e) {
      const error = this.boom.internalError(`Error triggering ${workflowIds.delete} workflow`).cause(e);
      this.log.error(error);
      // if workflow trigger failed then update environment record in db with failed status
      // first retrieve the revision number of the record we just created above
      const { rev } = await this.mustFind(requestContext, { id, fields: ['rev'] });
      await this.update(requestContext, { id, rev, status: environmentScStatus.TERMINATING_FAILED });

      throw error;
    }
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

  /**
   * Method assumes the environment management role in the AWS account where the specified environment is running and
   * constructs an instance of the specified AWS client SDK with the temporary credentials obtained by assuming the role.
   *
   * @param requestContext
   * @param id Id of the AWS Service Catalog based environment
   * @param clientName Name of the client SDK to create (E.g., S3, SageMaker, ServiceCatalog etc)
   * @param options Optional options object to pass to the client SDK (E.g., { apiVersion: '2011-06-15' })
   * @returns {Promise<void>}
   */
  async getClientSdkWithEnvMgmtRole(requestContext, { id }, { clientName, options }) {
    const [aws] = await this.service(['aws']);

    // The following will succeed only if the user has permissions to access
    // the specified environment
    const { indexId } = await this.mustFind(requestContext, {
      id,
      fields: ['indexId', 'createdBy'],
    });
    const { xAccEnvMgmtRoleArn, externalId } = await this.getEnvMgmtRoleInfoForIndex(requestContext, indexId);

    return aws.getClientSdkForRole({ roleArn: xAccEnvMgmtRoleArn, externalId, clientName, options });
  }

  async getEnvMgmtRoleInfoForIndex(requestContext, indexId) {
    const [indexesService, awsAccountsService] = await this.service(['indexesService', 'awsAccountsService']);
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });
    const { xAccEnvMgmtRoleArn, externalId } = await awsAccountsService.mustFind(requestContext, {
      id: awsAccountId,
    });
    return { xAccEnvMgmtRoleArn, externalId };
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'environment-authz', action, conditions },
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
module.exports = EnvironmentScService;
