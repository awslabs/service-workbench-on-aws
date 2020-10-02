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
const { v4: uuid } = require('uuid');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { isAdmin, isCurrentUser } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const createSchema = require('../../schema/create-environment-sc');
const updateSchema = require('../../schema/update-environment-sc');
const environmentScStatus = require('./environent-sc-status-enum');
const { hasConnections, cfnOutputsArrayToObject } = require('./helpers/connections-util');

const settingKeys = {
  tableName: 'dbTableEnvironmentsSc',
};
const workflowIds = {
  create: 'wf-provision-environment-sc',
  delete: 'wf-terminate-environment-sc',
  stopEC2: 'wf-stop-ec2-environment-sc',
  startEC2: 'wf-start-ec2-environment-sc',
  stopSagemaker: 'wf-stop-sagemaker-environment-sc',
  startSagemaker: 'wf-start-sagemaker-environment-sc',
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

  async augmentWithConnectionInfo(requestContext, envs) {
    if (!envs) {
      return envs;
    }

    await Promise.all(
      _.map(envs, async env => {
        env.hasConnections = await hasConnections(env.outputs);
      }),
    );

    // TODO: Add extension point so plugins can contribute in determining "hasConnections" flag

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

  async changeWorkspaceRunState(requestContext, { id, operation }) {
    const existingEnvironment = await this.mustFind(requestContext, { id });

    // Make sure the user has permissions to change the environment run state
    await this.assertAuthorized(
      requestContext,
      { action: 'update-sc', conditions: [this._allowAuthorized] },
      existingEnvironment,
    );

    const { status, outputs, projectId } = existingEnvironment;

    // expected environment run state based on operation
    let expectedStatus;
    switch (operation) {
      case 'start':
        expectedStatus = 'STOPPED';
        break;
      case 'stop':
        expectedStatus = 'COMPLETED';
        break;
      default:
        throw this.boom.badRequest(`operation ${operation} is not valid, only "start" and "stop" are supported`, true);
    }

    if (status !== expectedStatus) {
      throw this.boom.badRequest(
        `unable to ${operation} environment with id "${id}" - current status "${status}"`,
        true,
      );
    }
    let instanceType;
    let instanceIdentifier;
    const outputsObject = cfnOutputsArrayToObject(outputs);
    // TODO: Remove MetaConnection1Type check to include RStudio after CNAME patch
    if ('Ec2WorkspaceInstanceId' in outputsObject && _.get(outputsObject, 'MetaConnection1Type') !== 'RStudio') {
      instanceType = 'ec2';
      instanceIdentifier = outputsObject.Ec2WorkspaceInstanceId;
    } else if ('NotebookInstanceName' in outputsObject) {
      instanceType = 'sagemaker';
      instanceIdentifier = outputsObject.NotebookInstanceName;
    } else {
      throw this.boom.badRequest(
        `unable to ${operation} environment with id "${id}" - operation only supported for sagemaker and EC2 environemnt.`,
        true,
      );
    }

    const [awsAccountsService, indexesServices, projectService] = await this.service([
      'awsAccountsService',
      'indexesService',
      'projectService',
    ]);
    const { roleArn: cfnExecutionRole, externalId: roleExternalId } = await runAndCatch(
      async () => {
        const { indexId } = await projectService.mustFind(requestContext, { id: projectId });
        const { awsAccountId } = await indexesServices.mustFind(requestContext, { id: indexId });

        return awsAccountsService.mustFind(requestContext, { id: awsAccountId });
      },
      async () => {
        throw this.boom.badRequest(`account with id "${projectId} is not available`);
      },
    );

    // TODO: Update this to support other types and actions
    const meta = { workflowId: `wf-${operation}-${instanceType}-environment-sc` };
    const workflowTriggerService = await this.service('workflowTriggerService');
    const input = {
      environmentId: existingEnvironment.id,
      instanceIdentifier,
      requestContext,
      cfnExecutionRole,
      roleExternalId,
    };

    // This triggers the workflow defined in a workflow-plugin file
    // 'addons/addon-environment-sc-api/packages/environment-sc-workflows/lib/workflows'
    await workflowTriggerService.triggerWorkflow(requestContext, meta, input);
    return existingEnvironment;
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

    // Write audit event
    await this.audit(requestContext, { action: 'delete-environment-sc', body: existingEnvironment });

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
