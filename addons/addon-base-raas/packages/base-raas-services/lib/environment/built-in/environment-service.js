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
const uuid = require('uuid/v1');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const createSchema = require('../../schema/create-environment');
const updateSchema = require('../../schema/update-environment');

const settingKeys = {
  tableName: 'dbTableEnvironments',
  awsAccountsTableName: 'dbTableAwsAccounts',
  ec2RStudioAmiPrefix: 'ec2RStudioAmiPrefix',
  ec2LinuxAmiPrefix: 'ec2LinuxAmiPrefix',
  ec2WindowsAmiPrefix: 'ec2WindowsAmiPrefix',
  emrAmiPrefix: 'emrAmiPrefix',
};
const workflowIds = {
  create: 'wf-create-environment',
  delete: 'wf-delete-environment',
};

class EnvironmentService extends Service {
  constructor() {
    super();
    this.dependency([
      'jsonSchemaValidationService',
      'dbService',
      'workflowTriggerService',
      'environmentAmiService',
      'environmentMountService',
      'aws',
      'awsAccountsService',
      'indexesService',
      'projectService',
      'computePlatformService',
      'authorizationService',
      'environmentAuthzService',
      'auditWriterService',
      'userService',
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
    await this.assertAuthorized(requestContext, { action: 'list', conditions: [this._allowAuthorized] });

    // TODO: Handle pagination

    const environments = await this._scanner()
      .limit(1000)
      .scan();

    if (requestContext.principal.isAdmin) {
      return environments;
    }

    const envMap = environments.map((env, index) => {
      return {
        environmentsIndex: index,
      };
    });

    const authResult = await this.service('environmentAuthzService');

    const envPromises = envMap.map(env =>
      authResult.authorize(
        requestContext,
        { action: 'get', conditions: [this._allowAuthorized] },
        environments[env.environmentsIndex],
      ),
    );

    const envPromiseResolutions = await Promise.all(envPromises);

    const envAccessible = envPromiseResolutions
      .map((permission, index) => {
        return {
          permission,
          environmentsIndex: envMap[index].environmentsIndex,
        };
      })
      .filter(item => item.permission.effect === 'allow');

    return [...envAccessible].map(item => environments[item.environmentsIndex]);
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
      await this.assertAuthorized(requestContext, { action: 'get', conditions: [this._allowAuthorized] }, result);
    }

    return this._fromDbToDataObject(result);
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`environment with id "${id}" does not exist`, true);
    return result;
  }

  async saveEnvironmentToDb(requestContext, rawData, id, status = 'PENDING') {
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }
    // Prepare the db object
    const date = new Date().toISOString();
    const dbObject = this._fromRawToDbObject(rawData, {
      status,
      rev: 0,
      createdBy: by,
      updatedBy: by,
      createdAt: date,
      updatedAt: date,
    });

    // Time to save the the db object
    const dbResult = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // yes we need this
          .key({ id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.badRequest(`environment with id "${id}" already exists`, true);
      },
    );
    return dbResult;
  }

  async ensureAmiAccess(_requestContext, accountId, type) {
    // TODO - ami prefix should be coming from compute configuration object
    const amiPrefixKey = {
      'ec2-rstudio': settingKeys.ec2RStudioAmiPrefix,
      'ec2-linux': settingKeys.ec2LinuxAmiPrefix,
      'ec2-windows': settingKeys.ec2WindowsAmiPrefix,
      'emr': settingKeys.emrAmiPrefix,
    }[type];

    const amiPrefix = this.settings.get(amiPrefixKey);

    const environmentAmiService = await this.service('environmentAmiService');

    const { imageId } = await environmentAmiService.getLatest(amiPrefix);
    await environmentAmiService.ensurePermissions({ imageId, accountId });

    return imageId;
  }

  // This method is used to transform a newer environment request object (rawDataV2) to
  // the existing environment raw request (rawDataV1). This is needed because a complete refactoring has
  // not been done yet. The newer environment request object has a better modeling approach.
  //
  // This method returns rawDataV1 object that can be used inside the create and createExternal methods
  // The shape of the rawDataV1 is { name, description, indexId, projectId, isExternal, instanceInfo }
  // where instanceInfo has the shape { type, cidr, size, files, config }
  async transformToRawDataV1(requestContext, rawDataV2, indexId) {
    const [computePlatformService] = await this.service(['computePlatformService']);

    // { platformId, configurationId, name, description, projectId, studyIds, params }
    const { projectId, platformId, configurationId, studyIds } = rawDataV2;
    const configurations = await computePlatformService.listConfigurations(requestContext, {
      platformId,
      includePrice: true,
    });
    const configuration = _.find(configurations, ['id', configurationId]);

    const isMutableParam = name => _.has(configuration, ['params', 'mutable', name]);
    const getParam = name => {
      // First we see if the paramter is considered immutable, if so, we return its immutable value
      // otherwise we return the one from the rawDataV2.params if the parameter name is declared
      // in the configuration as mutable.
      const immutable = _.get(configuration, ['params', 'immutable', name]);
      if (!_.isUndefined(immutable)) return immutable;
      if (!isMutableParam(name)) return undefined;
      return _.get(rawDataV2, ['params', name]) || _.get(configuration, ['params', 'mutable', name]);
    };

    if (_.isUndefined(configuration)) {
      throw this.boom.badRequest('You do not have permissions to create this configuration', true);
    }

    const instanceInfo = {};
    const priceInfo = configuration.priceInfo;
    const addIfDefined = (key, value) => {
      if (_.isUndefined(value)) return;
      instanceInfo[key] = value;
    };

    addIfDefined('type', configuration.type);
    addIfDefined('cidr', getParam('cidr'));
    addIfDefined('size', getParam('size'));
    addIfDefined('files', studyIds); // Yes, rawDataV1 thinks that studyIds are files
    addIfDefined('config', getParam('emr') || {});

    if (priceInfo.type === 'spot') {
      _.set(instanceInfo, 'config.spotBidPrice', priceInfo.spotBidPrice);
    }

    const rawDataV1 = {
      platformId, // Even though v1 does not have this prop, we are adding it here
      configurationId, // Even though v1 does not have this prop, we are adding it here
      priceInfo, // Even though v1 does not have this props, we are adding it here
      name: rawDataV2.name,
      description: rawDataV2.description,
      instanceInfo,
      isExternal: _.get(requestContext, 'principal.isExternalUser', false),
    };

    if (projectId) rawDataV1.projectId = projectId;
    if (indexId) rawDataV1.indexId = indexId;

    return rawDataV1;
  }

  async createExternal(requestContext, rawDataV2) {
    // Make sure the user has permissions to create the external environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(
      requestContext,
      { action: 'create-external', conditions: [this._allowAuthorized] },
      rawDataV2,
    );

    const [validationService, awsAccountsService, environmentMountService] = await this.service([
      'jsonSchemaValidationService',
      'awsAccountsService',
      'environmentMountService',
    ]);
    // Validate input
    await validationService.ensureValid(rawDataV2, createSchema);

    const { accountId, ...rawData } = rawDataV2;
    const rawDataV1 = await this.transformToRawDataV1(requestContext, rawData);

    const mountInformation = await environmentMountService.getCfnStudyAccessParameters(requestContext, rawDataV1);

    Object.assign(rawDataV1.instanceInfo, mountInformation);

    const savedEnvironment = await this.saveEnvironmentToDb(requestContext, rawDataV1, uuid(), 'PENDING');

    await awsAccountsService.ensureExternalAccount(requestContext, { accountId });

    const {
      instanceInfo: { type },
    } = savedEnvironment;
    // Get AMI configuration where applicable
    if (['ec2-rstudio', 'ec2-linux', 'ec2-windows', 'emr'].includes(type)) {
      const imageId = await this.ensureAmiAccess(requestContext, accountId, type);
      savedEnvironment.amiImage = imageId;
    }

    // Write audit event
    await this.audit(requestContext, { action: 'create-external-environment', body: rawDataV2 });

    return savedEnvironment;
  }

  async create(requestContext, rawDataV2) {
    const [
      validationService,
      workflowTriggerService,
      awsAccountsService,
      indexesService,
      projectService,
    ] = await this.service([
      'jsonSchemaValidationService',
      'workflowTriggerService',
      'awsAccountsService',
      'indexesService',
      'projectService',
    ]);

    // Make sure the user has permissions to create the environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(requestContext, { action: 'create', conditions: [this._allowAuthorized] }, rawDataV2);

    // Validate input
    await validationService.ensureValid(rawDataV2, createSchema);

    // { platformId, configurationId, name, description, projectId, studyIds, params } => rawDataV2
    const { projectId } = rawDataV2;

    // Lets find the index id, by looking at the project and then load get the check the index id
    const { indexId } = await projectService.mustFind(requestContext, { id: projectId });

    // Time to convert the new rawDataV2 to the not so appealing rawDataV1
    const rawDataV1 = await this.transformToRawDataV1(requestContext, rawDataV2, indexId);

    // Get the aws account information
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });
    const {
      roleArn: cfnExecutionRole,
      externalId: roleExternalId,
      accountId,
      vpcId,
      subnetId,
      encryptionKeyArn,
    } = await awsAccountsService.mustFind(requestContext, { id: awsAccountId });

    // Check launch pre-requisites
    if (!(cfnExecutionRole && roleExternalId && accountId && vpcId && subnetId && encryptionKeyArn)) {
      const cause = this.getConfigError(cfnExecutionRole, roleExternalId, accountId, vpcId, subnetId, encryptionKeyArn);
      throw this.boom.badRequest(`Index "${indexId}" has not been correctly configured: missing ${cause}.`, true);
    }

    // Generate environment ID
    const id = uuid();

    const { instanceInfo, platformId } = rawDataV1;
    const { type, cidr } = instanceInfo;

    // trigger the provision environment workflow
    // TODO: remove CIDR default once its in the gui and backend
    const input = {
      environmentId: id,
      requestContext,
      cfnExecutionRole,
      roleExternalId,
      vpcId,
      subnetId,
      encryptionKeyArn,
      type,
      platformId,
      cidr,
    };

    // Get AMI configuration where applicable
    if (['ec2-rstudio', 'ec2-linux', 'ec2-windows', 'emr'].includes(type)) {
      const imageId = await this.ensureAmiAccess(requestContext, accountId, type);
      Object.assign(input, { amiImage: imageId });
    }

    // Time to save the the db object and trigger the workflow
    const meta = { workflowId: workflowIds.create };

    const dbResult = await this.saveEnvironmentToDb(requestContext, rawDataV1, id);
    await workflowTriggerService.triggerWorkflow(requestContext, meta, input);

    // Write audit event
    await this.audit(requestContext, { action: 'create-environment', body: rawDataV2 });

    return dbResult;
  }

  getConfigError(cfnExecutionRole, roleExternalId, accountId, vpcId, subnetId, encryptionKeyArn) {
    const causes = [];

    if (!cfnExecutionRole) causes.push('IAM role');
    if (!roleExternalId) causes.push('External ID');
    if (!accountId) causes.push('AWS account ID');
    if (!vpcId) causes.push('VPC ID');
    if (!subnetId) causes.push('VPC Subnet ID');
    if (!encryptionKeyArn) causes.push('Encryption Key ARN');

    if (causes.length > 1) {
      const last = causes.pop();
      return `${causes.join(', ')} and ${last}`;
    }
    if (causes.length > 0) {
      return causes[0];
    }

    return undefined;
  }

  async update(requestContext, environment) {
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    await jsonSchemaValidationService.ensureValid(environment, updateSchema);

    const by = _.get(requestContext, 'principalIdentifier'); // principalIdentifier shape is { username, ns: user.ns }

    // Prepare the db object
    // const dbObject = _.omit(this._fromRawToDbObject(dataObject, { updatedBy: by }), ['rev']);
    const existingEnvironment = await this.mustFind(requestContext, { id: environment.id });

    // Make sure the user has permissions to update the environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [this._allowAuthorized] },
      existingEnvironment,
    );

    if (existingEnvironment.isExternal) {
      // If the environment has finished and there are s3Prefixes to mount update the policies
      if (
        environment.status === 'COMPLETED' &&
        existingEnvironment.status === 'PENDING' &&
        existingEnvironment.instanceInfo.s3Prefixes.length > 0
      ) {
        const environmentMountService = await this.service('environmentMountService');

        await environmentMountService.addRoleArnToLocalResourcePolicies(
          environment.instanceInfo.WorkspaceInstanceRoleArn,
          existingEnvironment.instanceInfo.s3Prefixes,
        );
      }
    }

    const mergedInstanceInfo = _.assign({}, existingEnvironment.instanceInfo, environment.instanceInfo);
    const updatedEnvironment = _.omit(
      _.assign({}, existingEnvironment, environment, { instanceInfo: mergedInstanceInfo }),
      ['id'],
    );
    const dbObject = this._fromRawToDbObject(updatedEnvironment, {
      updatedBy: by,
      updatedAt: new Date().toISOString(),
    });

    // validate sharedWithUsers
    const sharedWithUsers = environment.sharedWithUsers || [];
    const userService = await this.service('userService');
    await userService.ensureActiveUsers(sharedWithUsers);

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id: environment.id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.notFound(`environment with id "${environment.id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-environment', body: environment });

    return result;
  }

  async delete(requestContext, { id }) {
    const existingEnvironment = await this.mustFind(requestContext, { id });

    // Make sure the user has permissions to delete the environment
    // The following will result in checking permissions by calling the condition function "this._allowAuthorized" first
    await this.assertAuthorized(
      requestContext,
      { action: 'delete', conditions: [this._allowAuthorized] },
      existingEnvironment,
    );

    if (existingEnvironment.status === 'TERMINATING' || existingEnvironment.status === 'TERMINATED') {
      this.log.info(`environment with id "${existingEnvironment.id}" is already terminating`);
      return;
    }

    if (existingEnvironment.isExternal) {
      // If studies were mounted, update the resoure policies to remove access
      if (
        existingEnvironment.instanceInfo.WorkspaceInstanceRoleArn &&
        existingEnvironment.instanceInfo.s3Prefixes.length > 0
      ) {
        const environmentMountService = await this.service('environmentMountService');

        await environmentMountService.removeRoleArnFromLocalResourcePolicies(
          existingEnvironment.instanceInfo.WorkspaceInstanceRoleArn,
          existingEnvironment.instanceInfo.s3Prefixes,
        );
      }

      existingEnvironment.status = 'TERMINATED';
      await this.update(requestContext, _.pick(existingEnvironment, ['id', 'status']));
      return;
    }

    const [awsAccountsService, indexesService] = await this.service(['awsAccountsService', 'indexesService']);
    const { indexId } = existingEnvironment;
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });
    const { roleArn: cfnExecutionRole, externalId: roleExternalId } = await awsAccountsService.mustFind(
      requestContext,
      { id: awsAccountId },
    );

    // trigger the delete environment workflow
    const input = {
      environmentId: existingEnvironment.id,
      requestContext,
      cfnExecutionRole,
      roleExternalId,
    };

    const meta = { workflowId: workflowIds.delete };
    const workflowTriggerService = await this.service('workflowTriggerService');
    await workflowTriggerService.triggerWorkflow(requestContext, meta, input);

    // Write audit event
    await this.audit(requestContext, { action: 'delete-environment', body: { id } });
  }

  async changeWorkspaceRunState(requestContext, { id, operation }) {
    const existingEnvironment = await this.mustFind(requestContext, { id });

    // Make sure the user has permissions to change the environment run state
    await this.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [this._allowAuthorized] },
      existingEnvironment,
    );

    // expected environment run state based on operation
    const expectedStatus = operation === 'start' ? 'STOPPED' : 'COMPLETED';

    const {
      status,
      instanceInfo: { type },
      projectId,
    } = existingEnvironment;
    if (status !== expectedStatus) {
      throw this.boom.badRequest(
        `unable to ${operation} environment with id "${id}" - current status "${status}"`,
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

    const workflowId = this.getWorkflowId({ type, prefix: `wf-${operation}-` });

    const meta = { workflowId };
    const workflowTriggerService = await this.service('workflowTriggerService');
    const input = {
      environmentId: existingEnvironment.id,
      requestContext,
      cfnExecutionRole,
      roleExternalId,
    };
    await workflowTriggerService.triggerWorkflow(requestContext, meta, input);
    return existingEnvironment;
  }

  getWorkflowId({ type, prefix }) {
    switch (type) {
      case 'ec2-windows':
      case 'ec2-linux':
      case 'ec2-rstudio':
        return `${prefix}ec2-environment`;
      case 'sagemaker':
        return `${prefix}sagemaker-environment`;
      default:
        throw this.boom.badRequest(`Invalid environment type ${type}`);
    }
  }

  async credsForAccountWithEnvironment(requestContext, { id }) {
    const [aws, awsAccountsService, indexesService] = await this.service([
      'aws',
      'awsAccountsService',
      'indexesService',
    ]);

    // The following will succeed only if the user has permissions to access
    // the specified environment
    const { status, indexId } = await this.mustFind(requestContext, {
      id,
      fields: ['status', 'indexId', 'createdBy', 'projectId', 'sharedWithUsers'],
    });

    if (status !== 'COMPLETED') {
      this.boom.badRequest(`environment with id "${id}" is not ready`, true);
    }

    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });
    const { roleArn: RoleArn, externalId: ExternalId } = await awsAccountsService.mustFind(requestContext, {
      id: awsAccountId,
    });

    const sts = new aws.sdk.STS();
    const {
      Credentials: { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken },
    } = await sts
      .assumeRole({
        RoleArn,
        RoleSessionName: `RaaS-${requestContext.principalIdentifier.username}`,
        ExternalId,
      })
      .promise();

    return { accessKeyId, secretAccessKey, sessionToken };
  }

  async getWindowsPasswordData(requestContext, { id }) {
    // Get environment and validate usage
    // The following will succeed only if the user has permissions to access the specified environment
    const environment = await this.mustFind(requestContext, { id });
    if (environment.instanceInfo.type !== 'ec2-windows') {
      throw this.boom.badRequest('Passwords can only be retrieved for EC2 Windows environments', true);
    }

    // Retrieve password data
    const aws = await this.service('aws');
    const ec2Client = new aws.sdk.EC2(await this.credsForAccountWithEnvironment(requestContext, { id }));
    const { PasswordData } = await ec2Client
      .getPasswordData({ InstanceId: environment.instanceInfo.Ec2WorkspaceInstanceId })
      .promise();

    return { passwordData: PasswordData };
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

module.exports = EnvironmentService;
