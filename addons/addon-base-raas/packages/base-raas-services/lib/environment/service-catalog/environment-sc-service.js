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
const YAML = require('js-yaml');
const { v4: uuid } = require('uuid');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');
const { isAdmin, isCurrentUser } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const createSchema = require('../../schema/create-environment-sc');
const updateSchema = require('../../schema/update-environment-sc');
const environmentScStatus = require('./environent-sc-status-enum');
const { hasConnections, cfnOutputsArrayToObject } = require('./helpers/connections-util');
const { hasAccess, accessLevels } = require('../../study/helpers/entities/study-methods');

const settingKeys = {
  tableName: 'dbEnvironmentsSc',
};
const workflowIds = {
  create: 'wf-provision-environment-sc',
  delete: 'wf-terminate-environment-sc',
  stopEC2: 'wf-stop-ec2-environment-sc',
  startEC2: 'wf-start-ec2-environment-sc',
  stopRStudio: 'wf-stop-rstudio-environment-sc',
  startRStudio: 'wf-start-rstudio-environment-sc',
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
      'iamService',
      'jsonSchemaValidationService',
      'dbService',
      'authorizationService',
      'environmentAuthzService',
      'storageGatewayService',
      'auditWriterService',
      'workflowTriggerService',
      'projectService',
      'awsAccountsService',
      'indexesService',
      'studyService',
    ]);
  }

  async init() {
    await super.init();
    const [dbService, environmentAuthzService] = await this.service(['dbService', 'environmentAuthzService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);

    // A private authorization condition function that just delegates to the environmentAuthzService
    this._allowAuthorized = (requestContext, { resource, action, effect, reason }, ...args) =>
      environmentAuthzService.authorize(requestContext, { resource, action, effect, reason }, ...args);
  }

  async list(requestContext, limit = 10000) {
    // Make sure the user has permissions to "list" environments
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(requestContext, { action: 'list-sc', conditions: [this._allowAuthorized] });

    const envs = await this._scanner()
      .limit(limit)
      .scan()
      .then(environments => {
        if (isAdmin(requestContext)) {
          return environments;
        }
        return environments.filter(env => isCurrentUser(requestContext, { uid: env.createdBy }));
      });

    return this.augmentWithConnectionInfo(requestContext, envs);
  }

  async pollAndSyncWsStatus(requestContext) {
    const [indexesService, awsAccountsService] = await this.service(['indexesService', 'awsAccountsService']);
    this.log.info('Start DB scan for status poll and sync.');
    let envs = await this._scanner({ fields: ['id', 'indexId', 'status', 'outputs'] })
      // Verified with EC2 support team that EC2 describe instances API can take 10K instanceIds without issue
      .limit(10000)
      .scan();
    envs = _.filter(
      envs,
      // Status polling is created to account for instance auto stop functionality
      // COMPLETED is included since the corresponding instance could be stopped
      // Other 'unstalbe' statuses are included as they could be result of a previous poll and sync
      env => _.includes(['COMPLETED', 'STARTING', 'STOPPING', 'TERMINATING'], env.status) && env.inWorkflow !== 'true',
    );
    const indexes = await indexesService.list(requestContext, { fields: ['id', 'awsAccountId'] });
    const indexesGroups = _.groupBy(indexes, index => index.awsAccountId);
    const envGroups = _.groupBy(envs, env => env.indexId);
    const accounts = await awsAccountsService.list(requestContext);
    const pollAndSyncPromises = accounts.map(account =>
      this.pollAndSyncWsStatusForAccount(requestContext, account, indexesGroups, envGroups),
    );
    const result = await Promise.all(pollAndSyncPromises);
    this.log.info(result);
    return result;
  }

  async pollAndSyncWsStatusForAccount(requestContext, account, indexesGroups, envGroups) {
    const { roleArn, externalId, id, accountId } = account;
    const { ec2Instances, sagemakerInstances } = this.getInstanceToCheck(_.get(indexesGroups, id), envGroups);
    let ec2Updated = {};
    let sagemakerUpdated = {};
    if (!_.isEmpty(ec2Instances)) {
      ec2Updated = await this.pollAndSyncEc2Status(roleArn, externalId, ec2Instances, requestContext);
    }
    if (!_.isEmpty(sagemakerInstances)) {
      sagemakerUpdated = await this.pollAndSyncSageMakerStatus(roleArn, externalId, sagemakerInstances, requestContext);
    }
    return { accountId, ec2Updated, sagemakerUpdated };
  }

  async pollAndSyncEc2Status(roleArn, externalId, ec2Instances, requestContext) {
    const EC2StatusMap = {
      'running': 'COMPLETED',
      'pending': 'STARTING',
      'stopping': 'STOPPING',
      'stopped': 'STOPPED',
      'shutting-down': 'TERMINATING',
      'terminated': 'TERMINATED',
    };
    const ec2RealtimeStatus = await this.pollEc2RealtimeStatus(roleArn, externalId, ec2Instances);
    const ec2Updated = {};
    _.forEach(ec2Instances, async (existingEnvRecord, ec2InstanceId) => {
      const expectedDDBStatus = EC2StatusMap[ec2RealtimeStatus[ec2InstanceId]];
      if (expectedDDBStatus && existingEnvRecord.status !== expectedDDBStatus) {
        const newEnvironment = {
          id: existingEnvRecord.id,
          rev: existingEnvRecord.rev || 0,
          status: expectedDDBStatus.toUpperCase(),
        };
        try {
          // Might run into situation where the environment was just updated and rev number does not match
          // Log the error and skip the update for now
          // The next invocation of poll and sync will do the sync if it's still needed
          await this.update(requestContext, newEnvironment);
          ec2Updated[ec2InstanceId] = {
            ddbID: existingEnvRecord.id,
            currentStatus: expectedDDBStatus,
            staleStatus: existingEnvRecord.status,
          };
        } catch (e) {
          this.log.error(`Error updating record ${existingEnvRecord.id}`);
          this.log.error(e);
        }
      }
    });
    return ec2Updated;
  }

  async pollEc2RealtimeStatus(roleArn, externalId, ec2Instances) {
    const aws = await this.service('aws');
    const ec2Client = await aws.getClientSdkForRole({ roleArn, externalId, clientName: 'EC2' });
    const params = {
      InstanceIds: Object.keys(ec2Instances),
    };
    const ec2RealtimeStatus = {};
    let data;
    do {
      data = await ec2Client.describeInstances(params).promise(); // eslint-disable-line no-await-in-loop
      params.NextToken = data.NextToken;
      data.Reservations.forEach(reservation => {
        reservation.Instances.forEach(instance => {
          ec2RealtimeStatus[instance.InstanceId] = instance.State.Name;
        });
      });
    } while (params.NextToken);
    return ec2RealtimeStatus;
  }

  async pollAndSyncSageMakerStatus(roleArn, externalId, sagemakerInstances, requestContext) {
    const SageMakerStatusMap = {
      InService: 'COMPLETED',
      Pending: 'STARTING',
      Updating: 'STARTING',
      Stopping: 'STOPPING',
      Stopped: 'STOPPED',
      Deleting: 'TERMINATING',
      Failed: 'FAILED',
    };
    const sagemakerRealtimeStatus = await this.pollSageMakerRealtimeStatus(roleArn, externalId);
    const sagemakerUpdated = {};
    _.forEach(sagemakerInstances, async (existingEnvRecord, key) => {
      const expectedDDBStatus = SageMakerStatusMap[sagemakerRealtimeStatus[key]];
      if (expectedDDBStatus && existingEnvRecord.status !== expectedDDBStatus) {
        const newEnvironment = {
          id: existingEnvRecord.id,
          rev: existingEnvRecord.rev || 0,
          status: SageMakerStatusMap[sagemakerRealtimeStatus[key]].toUpperCase(),
        };
        try {
          // Might run into situation where the environment was just updated and rev number does not match
          // Log the error and skip the update for now
          // The next invocation of poll and sync will do the sync if it's still needed
          await this.update(requestContext, newEnvironment);
          sagemakerUpdated[key] = {
            ddbID: existingEnvRecord.id,
            currentStatus: expectedDDBStatus,
            staleStatus: existingEnvRecord.status,
          };
        } catch (e) {
          this.log.error(`Error updating record ${existingEnvRecord.id}`);
          this.log.error(e);
        }
      }
    });
    return sagemakerUpdated;
  }

  async pollSageMakerRealtimeStatus(roleArn, externalId) {
    const aws = await this.service('aws');
    const sagemakerClient = await aws.getClientSdkForRole({ roleArn, externalId, clientName: 'SageMaker' });
    const params = { MaxResults: 100 };
    const sagemakerRealtimeStatus = {};
    do {
      const data = await sagemakerClient.listNotebookInstances(params).promise(); // eslint-disable-line no-await-in-loop
      params.NextToken = data.NextToken;
      data.NotebookInstances.forEach(instance => {
        sagemakerRealtimeStatus[instance.NotebookInstanceName] = instance.NotebookInstanceStatus;
      });
    } while (params.NextToken);
    return sagemakerRealtimeStatus;
  }

  getInstanceToCheck(indexList, envGroups) {
    const ec2Instances = {};
    const sagemakerInstances = {};
    _.forEach(indexList, index => {
      const envs = _.get(envGroups, index.id);
      if (envs) {
        envs.forEach(env => {
          const outputsObject = cfnOutputsArrayToObject(env.outputs);
          if ('Ec2WorkspaceInstanceId' in outputsObject) {
            ec2Instances[outputsObject.Ec2WorkspaceInstanceId] = env;
          } else if ('NotebookInstanceName' in outputsObject) {
            sagemakerInstances[outputsObject.NotebookInstanceName] = env;
          }
        });
      }
    });
    return { ec2Instances, sagemakerInstances };
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

  /**
   * Returns the member account entity in which given an environment is running.
   *
   * @param environmentScEntity The environmentScEntity object with the 'indexId' property populated
   */
  async getMemberAccount(requestContext, environmentScEntity) {
    const [indexesService, awsAccountsService] = await this.service(['indexesService', 'awsAccountsService']);
    const { indexId } = environmentScEntity;
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });
    const accountEntity = awsAccountsService.mustFind(requestContext, { id: awsAccountId });

    return accountEntity;
  }

  async getActiveEnvsForUser(userUid) {
    const filterStatus = ['TERMINATING', 'TERMINATED'];
    const envs = await this._query()
      .index('ByOwnerUID')
      .key('createdBy', userUid)
      .query();

    // Filter out terminated and bad state environments
    return _.filter(envs, env => !_.includes(filterStatus, env.status) && !env.status.includes('FAILED'));
  }

  async find(requestContext, { id, fields = [], fetchCidr = true }) {
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

    // We only check for the ingress rules of a successfully provisioned environment not in failure state
    if (
      _.includes(
        [
          environmentScStatus.COMPLETED,
          environmentScStatus.STOPPED,
          environmentScStatus.STOPPING,
          environmentScStatus.STARTING,
        ],
        env.status,
      ) &&
      fetchCidr
    ) {
      const { currentIngressRules } = await this.getSecurityGroupDetails(requestContext, env);
      env.cidr = currentIngressRules;
    }
    const [toReturn] = await this.augmentWithConnectionInfo(requestContext, [env]);
    return toReturn;
  }

  async mustFind(requestContext, { id, fields = [], fetchCidr = true }) {
    const result = await this.find(requestContext, { id, fields, fetchCidr });
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
    const by = _.get(requestContext, 'principalIdentifier.uid');
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
      inWorkflow: 'true',
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
      await this.update(requestContext, { id, rev, status: environmentScStatus.FAILED, inWorkflow: 'false' });

      throw error;
    }

    return dbResult;
  }

  async update(requestContext, environment, ipAllowListAction = {}) {
    // Validate input
    const [validationService, storageGatewayService] = await this.service([
      'jsonSchemaValidationService',
      'storageGatewayService',
    ]);
    await validationService.ensureValid(_.omit(environment, ['studyRoles']), updateSchema);

    // Retrieve the existing environment, this is required for authorization below
    const existingEnvironment = await this.mustFind(requestContext, { id: environment.id });

    // Make sure the user has permissions to create the environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(
      requestContext,
      { action: 'update-sc', conditions: [this._allowAuthorized] },
      existingEnvironment,
    );

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { id, rev } = environment;

    // Prepare the db object
    const dbObject = _.omit(this._fromRawToDbObject(environment, { updatedBy: by }), ['rev', 'studyRoles']);

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
            `environment information changed just before your request is processed, please try again`,
            true,
          );
        }
        throw this.boom.notFound(`environment with id "${id}" does not exist`, true);
      },
    );

    // Handle IP allow list update if needed
    if (!_.isEmpty(existingEnvironment.studyIds) && !_.isEmpty(ipAllowListAction)) {
      await storageGatewayService.updateStudyFileMountIPAllowList(
        requestContext,
        existingEnvironment,
        ipAllowListAction,
      );
    }

    // Write audit event
    await this.audit(requestContext, { action: 'update-environment-sc', body: environment });

    return result;
  }

  /**
   * Returns an array of StudyEntity that are associated with the environment. If a study is listed as part of the
   * environment studyIds but the creator of the environment no longer has access to the study, then the study
   * will not be part of the study entities returned by this method.
   *
   * IMPORTANT: each element in the array is the standard StudyEntity, however, there is one additional attributes
   * added to each of the StudyEntity. This additional attribute is called 'envPermission', it is an object with the
   * following shape: { read: true/false, write: true/false }
   *
   * @param requestContext The standard request context
   * @param environmentScEntity The environmentScEntity
   */
  async getStudies(requestContext, environmentScEntity) {
    const studyService = await this.service('studyService');

    const studyIds = environmentScEntity.studyIds;
    const createdBy = environmentScEntity.createdBy;

    if (_.isEmpty(studyIds)) return [];

    const acceptedStudies = [];
    const systemContext = getSystemRequestContext();
    const studies = await studyService.listByIds(
      systemContext,
      _.map(studyIds, id => ({ id })),
    );

    // Time to populate the envPermission: { write: read: }
    const permissionLookup = async study => {
      const entity = await studyService.getStudyPermissions(systemContext, study.id);
      if (hasAccess(entity, createdBy)) {
        const { read, write } = accessLevels(entity, createdBy);
        study.envPermission = { read, write };
        acceptedStudies.push(study);
      }
      // Note: if the createdBy does not have access to the study, we simply don't return include this study at all.
      // We don't want to throw an exception here. This is because this method can be used during a workspace
      // termination and it is possible that the workspace lost its access to the study while it was active.
    };

    await Promise.all(_.map(studies, permissionLookup));

    return acceptedStudies;
  }

  /**
   * Updates the study role map for the environment sc entity.
   *
   * @param requestContext The standard request context
   * @param rawData The study role map. Keys are the study ids and values are the role arns
   */
  async updateStudyRoles(requestContext, id, rawData) {
    // disable CIDR fetching to save latency. We don't need CIDR ranges here for updating study roles
    const envEntity = await this.mustFind(requestContext, { id, fetchCidr: false });
    await this.assertAuthorized(
      requestContext,
      { action: 'update-study-role-map', conditions: [this._allowAuthorized] },
      envEntity,
    );

    // lets ensure that rawData only contains values that are strings
    _.forEach(rawData, (value, key) => {
      if (!_.isString(value) || _.isEmpty(value)) {
        throw this.boom.badRequest(
          `The study role map can only contain values of type string and can not be empty. Received incorrect value for the key '${key}'`,
          true,
        );
      }
    });

    if (_.isUndefined(rawData)) throw this.boom.badRequest('No study role map is provided', true);
    if (_.isEmpty(id)) throw this.boom.badRequest('No environment id was provided', true);

    const by = _.get(requestContext, 'principalIdentifier.uid');

    // Prepare the db object
    const dbObject = { studyRoles: rawData, updatedBy: by };

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // make sure the record being updated exists
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.notFound(`environment with id "${id}" does not exist`, true);
      },
    );

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
    if ('Ec2WorkspaceInstanceId' in outputsObject && _.get(outputsObject, 'MetaConnection1Type') !== 'RStudio') {
      instanceType = 'ec2';
      instanceIdentifier = outputsObject.Ec2WorkspaceInstanceId;
    } else if ('Ec2WorkspaceInstanceId' in outputsObject && _.get(outputsObject, 'MetaConnection1Type') === 'RStudio') {
      instanceType = 'rstudio';
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

  async getCfnExecutionRoleArn(requestContext, env) {
    const [awsAccountsService, indexesServices, projectService] = await this.service([
      'awsAccountsService',
      'indexesService',
      'projectService',
    ]);
    const { roleArn: cfnExecutionRoleArn, externalId: roleExternalId } = await runAndCatch(
      async () => {
        const { indexId } = await projectService.mustFind(requestContext, { id: env.projectId });
        const { awsAccountId } = await indexesServices.mustFind(requestContext, { id: indexId });

        return awsAccountsService.mustFind(requestContext, { id: awsAccountId });
      },
      async () => {
        throw this.boom.badRequest(`account with id "${env.projectId} is not available`);
      },
    );

    return { cfnExecutionRoleArn, roleExternalId };
  }

  /**
   * Returns an aws sdk instance configured with the correct role so that the sdk can be used to update
   * the environment resources in the hosting account (a.k.a member account).
   *
   * @param requestContext The standard request context
   * @param environmentScEntity The environmentScEntity
   */
  async getIamClient(requestContext, environmentScEntity) {
    const aws = await this.service('aws');
    const { cfnExecutionRoleArn, roleExternalId } = await this.getCfnExecutionRoleArn(
      requestContext,
      environmentScEntity,
    );

    const iamClient = await aws.getClientSdkForRole({
      roleArn: cfnExecutionRoleArn,
      externalId: roleExternalId,
      clientName: 'IAM',
    });

    return iamClient;
  }

  /**
   * Updates the role policy document in the environment instance profile role.  If the provided policy document is empty,
   * then this method removes the policy doc from the role (if it existed).
   *
   * @param requestContext The standard request context
   * @param environmentScEntity The environmentScEntity
   * @param policyDoc The policy document
   */
  async updateRolePolicy(requestContext, environmentScEntity, policyDoc) {
    const iamService = await this.service('iamService');
    const { roleName, policyName, exists } = await this.getRolePolicy(requestContext, environmentScEntity);
    const iamClient = await this.getIamClient(requestContext, environmentScEntity);

    const empty = _.isEmpty(policyDoc);

    if (exists && empty) {
      // Remove the policy
      await iamService.deleteRolePolicy(roleName, policyName, iamClient);
    } else {
      // Update/create the policy
      await iamService.putRolePolicy(roleName, policyName, JSON.stringify(policyDoc), iamClient);
    }
  }

  /**
   * Returns information about the role policy document in the environment instance profile role. The returned object
   * has this shape: { policyName, policyDoc, roleName, exists }
   *
   * @param requestContext The standard request context
   * @param environmentScEntity The environmentScEntity
   */
  async getRolePolicy(requestContext, environmentScEntity) {
    const workspaceRoleObject = _.find(environmentScEntity.outputs, { OutputKey: 'WorkspaceInstanceRoleArn' });
    if (!workspaceRoleObject) {
      throw new Error(
        'Workspace IAM Role is not ready yet. It is possible that the environment is still in pending state',
      );
    }

    // We need to figure out the policy name inside the workspace role. This policy was originally created in the
    // service catalog product template. Because we named this policy differently in different releases, we need
    // to account for that when we try to find the policy.
    const workspaceRoleArn = workspaceRoleObject.OutputValue;
    const roleName = workspaceRoleArn.split('role/')[1];
    const policyNamePrefix = `analysis-${workspaceRoleArn.split('-')[1]}`;
    const possibleInlinePolicyNames = [
      `${policyNamePrefix}-s3-studydata-policy`,
      `${policyNamePrefix}-s3-data-access-policy`,
      `${policyNamePrefix}-s3-policy`,
    ];

    const iamClient = await this.getIamClient(requestContext, environmentScEntity);
    const policy = await this.getPolicy(possibleInlinePolicyNames, roleName, iamClient);
    const policyDoc = _.get(policy, 'PolicyDocumentObj', {});
    const policyName = _.get(policy, 'PolicyName', possibleInlinePolicyNames[0]);

    return { policyDoc, roleName, policyName, exists: !_.isUndefined(policy) };
  }

  /**
   * @private
   *
   * This method looks for inline policy based on the given array of "possibleInlinePolicyNames".
   * The method returns as soon as it finds an inline policy in the given role (identified by the "roleName")
   * with a matching name from the "possibleInlinePolicyNames". If no inline policy is found with any of the names from
   * the "possibleInlinePolicyNames", the method returns undefined.
   *
   * @param {Object} possibleInlinePolicyNames - Known policy names we have used in out-of-the-box SC product templates
   * @param {Object} roleName - Name of the IAM role for the given workspace
   * @param {Object} iamClient
   * @returns {Object} - Returns policy object
   */
  async getPolicy(possibleInlinePolicyNames, roleName, iamClient) {
    const iamService = await this.service('iamService');

    // eslint-disable-next-line no-restricted-syntax
    for (const possiblePolicyName of possibleInlinePolicyNames) {
      // eslint-disable-next-line no-await-in-loop
      const policy = await iamService.getRolePolicy(roleName, possiblePolicyName, iamClient);
      if (policy && policy.PolicyDocumentObj) {
        return policy;
      }
    }
    return undefined;
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

    await this.update(requestContext, {
      id,
      rev: existingEnvironment.rev,
      status: environmentScStatus.TERMINATING,
      inWorkflow: 'true',
    });

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
      await this.update(requestContext, {
        id,
        rev,
        status: environmentScStatus.TERMINATING_FAILED,
        inWorkflow: 'false',
      });

      throw error;
    }
  }

  async getCfnDetails(requestContext, environment, cfnStackLogicalId) {
    const cfnClient = await this.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: environment.id },
      { clientName: 'CloudFormation', options: { apiVersion: '2016-11-15' } },
    );
    const stackResources = await cfnClient.listStackResources({ StackName: cfnStackLogicalId }).promise();
    const templateDetails = await cfnClient
      .getTemplate({ StackName: cfnStackLogicalId, TemplateStage: 'Original' })
      .promise();

    return { stackResources, templateDetails };
  }

  async getWorkspaceSecurityGroup(requestContext, environment, securityGroupId) {
    const ec2Client = await this.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: environment.id },
      { clientName: 'EC2', options: { apiVersion: '2016-11-15' } },
    );
    const securityGroupResponse = await ec2Client.describeSecurityGroups({ GroupIds: [securityGroupId] }).promise();
    return { securityGroupResponse };
  }

  /**
   * Method assumes the environment management role in the AWS account where the specified environment is running and
   * fetches the SC CFN template and the current ingress rules of its security group
   *
   * @param requestContext
   * @param environment AWS Service Catalog based environment
   * @returns {Promise<*>} SecurityGroupId for the workspace and its current Ingress Rules
   */
  async getSecurityGroupDetails(requestContext, environment) {
    const outputsObject = cfnOutputsArrayToObject(environment.outputs);
    const cfnStackLogicalId = outputsObject.CloudformationStackARN.split('/')[1];
    const { stackResources, templateDetails } = await this.getCfnDetails(
      requestContext,
      environment,
      cfnStackLogicalId,
    );
    const templateBody = YAML.load(templateDetails.TemplateBody);

    if (
      _.isUndefined(templateBody.Resources.SecurityGroup) &&
      _.isUndefined(templateBody.Resources.MasterSecurityGroup)
    ) {
      // Do NOT throw an error here because this is being used by the GET ScEnv API (which is also used to build the View Details page)
      // Rather send back an empty array of ingress rules, to show none were configured in SC template
      return { currentIngressRules: [] };
    }

    const cfnTemplateIngressRules = templateBody.Resources.SecurityGroup
      ? templateBody.Resources.SecurityGroup.Properties.SecurityGroupIngress
      : templateBody.Resources.MasterSecurityGroup.Properties.SecurityGroupIngress; // For EMR use-cases

    const securityGroup =
      _.find(stackResources.StackResourceSummaries, resource => resource.LogicalResourceId === 'SecurityGroup') ||
      _.find(stackResources.StackResourceSummaries, resource => resource.LogicalResourceId === 'MasterSecurityGroup'); // For EMR use-cases
    const securityGroupId = securityGroup.PhysicalResourceId;
    const { securityGroupResponse } = await this.getWorkspaceSecurityGroup(
      requestContext,
      environment,
      securityGroupId,
    );

    // Get protocol-port combinations from the SC CFN stack
    const securityGroupDetails = securityGroupResponse.SecurityGroups[0];
    const workspaceIngressRules = securityGroupDetails.IpPermissions;

    // Only send back details of groups configured by the SC CFN stack
    const returnVal = _.map(cfnTemplateIngressRules, cfnRule => {
      const matchingRule = _.find(
        workspaceIngressRules,
        workspaceRule =>
          cfnRule.FromPort === workspaceRule.FromPort &&
          cfnRule.ToPort === workspaceRule.ToPort &&
          cfnRule.IpProtocol === workspaceRule.IpProtocol,
      );
      const currentCidrRanges = matchingRule ? _.map(matchingRule.IpRanges, ipRange => ipRange.CidrIp) : [];

      return {
        fromPort: cfnRule.FromPort,
        toPort: cfnRule.ToPort,
        protocol: cfnRule.IpProtocol,
        cidrBlocks: currentCidrRanges,
      };
    });

    return { currentIngressRules: returnVal, securityGroupId };
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
