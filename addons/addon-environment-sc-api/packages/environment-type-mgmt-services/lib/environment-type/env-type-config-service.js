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

/* eslint-disable no-template-curly-in-string */
const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { isAllow, allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const createEnvTypeConfigSchema = require('./schema/create-or-update-env-type-config');

const updateEnvTypeConfigSchema = createEnvTypeConfigSchema;

const settingKeys = {
  envTypeConfigsBucketName: 'envTypeConfigsBucketName',
  envTypeConfigsPrefix: 'envTypeConfigsPrefix',
  isAppStreamEnabled: 'isAppStreamEnabled',
};

/**
 * The environment type configurations management service
 */
class EnvTypeConfigService extends Service {
  constructor() {
    super();
    this.dependency([
      'jsonSchemaValidationService',
      'aws',
      'authorizationService',
      'auditWriterService',
      's3Service',
      'envTypeService',
      'envTypeConfigAuthzService',
    ]);
  }

  async init() {
    await super.init();
    const [envTypeConfigAuthzService] = await this.service(['envTypeConfigAuthzService']);

    // A private authorization condition function that just delegates to the envTypeConfigAuthzService
    this._allowAuthorized = (requestContext, { resource, action, effect, reason }, ...args) =>
      envTypeConfigAuthzService.authorize(requestContext, { resource, action, effect, reason }, ...args);
  }

  async list(requestContext, envTypeId, includeAll = false) {
    const [envTypeService] = await this.service(['envTypeService']);

    // The following call will ensure that the specified environment type exists and the caller
    // has permissions to read information about the given environment type
    const envType = await envTypeService.mustFind(requestContext, { id: envTypeId });
    const listOfConfigs = await this.getConfigsFromS3(envType.id);

    // Filter out env type configs the user does not have permissions to use
    const result = await Promise.all(
      _.map(listOfConfigs, async envTypeConfig => {
        const shouldInclude = await this.isAuthorized(
          requestContext,
          {
            action: 'use-config',
            conditions: [this._allowAuthorized],
          },
          envTypeConfig,
        );
        return shouldInclude ? envTypeConfig : undefined;
      }),
    );
    const usableConfigs = _.filter(result, _.negate(_.isNil)); // filter out undefined

    if (!includeAll) {
      return usableConfigs;
    }

    // if requested to list all env type configs and if the user is allowed to list all
    // then return all. By default, only active admin users are allowed to include all
    // env type configs
    const allowedToListAllConfigs = await this.isAuthorized(requestContext, {
      action: 'list-all-configs',
      conditions: [allowIfActive, allowIfAdmin],
    });
    if (!allowedToListAllConfigs) {
      return usableConfigs;
    }

    // when returning all env type configs (usable + the ones not allowed to use), set additional flag indicating
    // which ones can be used
    return _.map(listOfConfigs, envTypeConfig => {
      envTypeConfig.allowedToUse = !_.isEmpty(_.find(usableConfigs, uc => uc.id === envTypeConfig.id));
      return envTypeConfig;
    });
  }

  async find(requestContext, envTypeId, { id }) {
    const configs = await this.list(requestContext, envTypeId);
    return _.find(configs, { id });
  }

  async mustFind(requestContext, envTypeId, { id }) {
    const result = await this.find(requestContext, envTypeId, { id });
    if (!result)
      throw this.boom.notFound(
        `environment type config for env type with id "${envTypeId}" with config id "${id}" does not exist`,
        true,
      );
    return result;
  }

  async create(requestContext, envTypeId, config) {
    // ensure that the caller has permissions to add env type config
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'create-config', conditions: [allowIfActive, allowIfAdmin] },
      envTypeId,
      config,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(config, createEnvTypeConfigSchema);

    const [s3Service, envTypeService] = await this.service(['s3Service', 'envTypeService']);

    // The following call will ensure that the specified environment type exists and the caller
    // has permissions to read information about the given environment type
    const envType = await envTypeService.mustFind(requestContext, { id: envTypeId });

    // Make sure the specified configuration has params mapping specified for
    // all non-default CFN input params for the given env type
    const updatedConfig = await this.checkAndUpdateParams(envType, config);

    // Make sure the config with the same id for the same env type does not exist already
    const existingConfigs = await this.getConfigsFromS3(envTypeId);
    const existingConfig = _.find(existingConfigs, { id: updatedConfig.id });
    if (existingConfig) {
      throw this.boom.badRequest(
        `The environment type configuration with id "${updatedConfig.id}" for environment type "${envTypeId}" already exists`,
        true,
      );
    }

    // Everything is good so far, time to save the given configuration to S3 now
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { bucket, key } = await this.getS3Coordinates(envType.id);
    const now = new Date().toISOString();
    const configToSave = this.fromRawToS3Object(updatedConfig, {
      createdBy: by,
      updatedBy: by,
      createdAt: now,
      updatedAt: now,
    });
    const configsToSave = existingConfigs || [];
    configsToSave.push(configToSave);

    await s3Service.api
      .putObject({
        Body: JSON.stringify(configsToSave),
        Bucket: bucket,
        Key: key,
      })
      .promise();

    const savedConfig = this.fromS3ToDataObject(configToSave);

    // Write audit event
    await this.audit(requestContext, { action: 'create-environment-type-config', body: savedConfig });

    return savedConfig;
  }

  async update(requestContext, envTypeId, config) {
    // ensure that the caller has permissions to update env type config
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'update-config', conditions: [allowIfActive, allowIfAdmin] },
      envTypeId,
      config,
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(config, updateEnvTypeConfigSchema);

    const [s3Service, envTypeService] = await this.service(['s3Service', 'envTypeService']);

    // The following call will ensure that the specified environment type exists and the caller
    // has permissions to read information about the given environment type
    const envType = await envTypeService.mustFind(requestContext, { id: envTypeId });

    // Make sure the config being updated exists
    const existingConfigs = await this.getConfigsFromS3(envTypeId);
    const existingConfig = _.find(existingConfigs, { id: config.id });
    if (!existingConfig) {
      throw this.boom.badRequest(
        `The environment type configuration with id "${config.id}" for environment type "${envTypeId}" does not exists`,
        true,
      );
    }

    // Merge given config with the existing config before updating
    let configToUpdate = { ...existingConfig, ...config };

    configToUpdate = await this.checkAndUpdateParams(envType, configToUpdate);

    // Everything is good so far, time to save the given configuration to S3 now
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const { bucket, key } = await this.getS3Coordinates(envType.id);
    const now = new Date().toISOString();
    const configToSave = this.fromRawToS3Object(configToUpdate, { updatedBy: by, updatedAt: now });
    const configsToSave = existingConfigs || [];

    // We need to preserve order of configs in the array so replace new one at correct index
    const idxOfConfig = _.findIndex(existingConfigs, existingConfig);
    configsToSave[idxOfConfig] = configToSave;

    await s3Service.api
      .putObject({
        Body: JSON.stringify(configsToSave),
        Bucket: bucket,
        Key: key,
      })
      .promise();

    const savedConfig = this.fromS3ToDataObject(configToSave);

    // Write audit event
    await this.audit(requestContext, { action: 'update-environment-type-config', body: savedConfig });

    return savedConfig;
  }

  async checkAndUpdateParams(envType, config) {
    const isAppStreamEnabled = this.settings.getBoolean(settingKeys.isAppStreamEnabled);
    const updatedConfig = { ...config };
    updatedConfig.params.push({
      key: 'IsAppStreamEnabled',
      value: isAppStreamEnabled.toString(),
    });
    let params = [...updatedConfig.params];
    if (isAppStreamEnabled) {
      params = [
        ...params,
        {
          key: 'AccessFromCIDRBlock',
          value: '',
        },
        // Let's automatically fill in these values for the customer
        { key: 'EgressStoreIamPolicyDocument', value: '${egressStoreIamPolicyDocument}' },
        { key: 'SolutionNamespace', value: '${solutionNamespace}' },
      ];
    } else {
      params = [
        ...params,
        { key: 'EgressStoreIamPolicyDocument', value: '{}' },
        { key: 'SolutionNamespace', value: '' },
      ];
    }
    updatedConfig.params = params;
    // Make sure the specified configuration has params mapping specified for
    // all non-default CFN input params for the given env type
    await this.assertNoMissingParams(envType, updatedConfig);
    return updatedConfig;
  }

  async delete(requestContext, envTypeId, configId) {
    // ensure that the caller has permissions to delete env type config
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'delete-config', conditions: [allowIfActive, allowIfAdmin] },
      envTypeId,
      configId,
    );

    const [s3Service, envTypeService] = await this.service(['s3Service', 'envTypeService']);

    // The following call will ensure that the specified environment type exists and the caller
    // has permissions to read information about the given environment type
    const envType = await envTypeService.mustFind(requestContext, { id: envTypeId });

    // Make sure the config being updated exists
    const existingConfigs = await this.getConfigsFromS3(envTypeId);
    const existingConfig = _.find(existingConfigs, { id: configId });
    if (!existingConfig) {
      throw this.boom.badRequest(
        `The environment type configuration with id "${configId}" for environment type "${envTypeId}" does not exists`,
        true,
      );
    }

    // Everything is good so far, time to delete the config from S3 now
    const { bucket, key } = await this.getS3Coordinates(envType.id);

    // We need to preserve order of configs in the array so delete at correct index
    const idxOfConfig = _.findIndex(existingConfigs, existingConfig);
    existingConfigs.splice(idxOfConfig, 1);

    await s3Service.api
      .putObject({
        Body: JSON.stringify(existingConfigs),
        Bucket: bucket,
        Key: key,
      })
      .promise();

    const deletedConfig = this.fromS3ToDataObject(existingConfig);

    // Write audit event
    await this.audit(requestContext, { action: 'delete-environment-type-config', body: deletedConfig });

    return deletedConfig;
  }

  // Do some properties renaming to prepare the object to be saved in the S3
  fromRawToS3Object(rawObject, overridingProps = {}) {
    const dbObject = { ...rawObject, ...overridingProps };
    return dbObject;
  }

  // Do some properties renaming to restore the object that was saved in S3
  fromS3ToDataObject(rawDb, overridingProps = {}) {
    if (_.isNil(rawDb)) return rawDb;
    if (!_.isObject(rawDb)) return rawDb;

    const dataObject = { ...rawDb, ...overridingProps };
    return dataObject;
  }

  /**
   * Private utility function to retrieve configurations for the given env type from S3.
   * Outside of the class, please use the "list" method and not this one.
   *
   * @param envTypeId
   * @returns {Promise<*[]|any>}
   */
  async getConfigsFromS3(envTypeId) {
    const [s3Service] = await this.service(['s3Service']);
    try {
      const { bucket, key } = await this.getS3Coordinates(envTypeId);
      const result = await s3Service.api
        .getObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();
      const body = result.Body || '[]';
      const configStr = body.toString('utf8');
      const configs = JSON.parse(configStr);
      return configs;
    } catch (e) {
      if (e.code === 'NoSuchKey') {
        // If the config is not found in S3 then it means the env type does
        // not have any configs, return an empty array in that case
        return [];
      }
      throw this.boom
        .internalError(`Error reading environment type configurations for env type with id = ${envTypeId}`, false)
        .cause(e);
    }
  }

  async assertNoMissingParams(envType, config) {
    // Make sure the specified configuration is complete and provides mapping
    // for all non-default CFN input parameters
    const cfnInputParams = envType.params || [];
    // The cfnInputParams is  an array of CFN parameters with the following shape
    /*
      [
        {
            "DefaultValue": "Some optional default value for the param",
            "IsNoEcho": false,
            "ParameterConstraints": {
                "AllowedValues": []
            },
            "ParameterType": "String",
            "Description": "The ARN of the KMS encryption Key used to encrypt data in the notebook",
            "ParameterKey": "EncryptionKeyArn"
        },
       ]
    */
    // Find all cfn input params that do not have any DefaultValue
    const paramKeysNoDefault = _.map(
      _.filter(cfnInputParams, p => !p.DefaultValue),
      p => p.ParameterKey,
    );

    // The config.params is an array of param mapping objects containing mapping
    // of CFN parameters to values or to dynamic variable expressions with the
    // following shape
    /*
      [
        {
          key // The name of the CFN parameter
          value // The value for the CFN param or variable expression such as ${vpcId} that will be resolved at the time of launching envs
        }
      ]
     */
    const paramKeysInConfig = _.map(config.params, p => p.key);
    const missingParamKeys = _.difference(paramKeysNoDefault, paramKeysInConfig);
    if (!_.isEmpty(missingParamKeys)) {
      throw this.boom.badRequest(
        `The given configuration is missing parameter mappings for the following AWS Cloud Formation input params "${_.join(
          missingParamKeys,
        )}"
        Make sure to provide parameters mapping for all the AWS Cloud Formation input params that do not have default value for the AWS Service Catalog Product/Version you are importing to the platform.
        `,
        true,
      );
    }
  }

  /**
   * A private utility method that returns the S3 bucket name and key for saving/retrieving environment type
   * configurations for the given environment type
   *
   * @param envTypeId Id of the environment type
   * @returns {{bucket: string, key: string}}
   */
  async getS3Coordinates(envTypeId) {
    const bucket = this.settings.get(settingKeys.envTypeConfigsBucketName);
    const key = `${this.settings.optional(settingKeys.envTypeConfigsPrefix, 'configs')}/${envTypeId}`;
    return { bucket, key };
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
module.exports = EnvTypeConfigService;
