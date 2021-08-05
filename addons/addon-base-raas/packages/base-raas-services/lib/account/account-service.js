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
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const { isExternalGuest, isExternalResearcher, isInternalGuest } = require('../helpers/is-role');
const createSchema = require('../schema/create-account');
const updateSchema = require('../schema/update-account');

const settingKeys = {
  tableName: 'dbAccounts',
  apiHandlerArn: 'apiHandlerArn',
  workflowRoleArn: 'workflowRoleArn',
  isAppStreamEnabled: 'isAppStreamEnabled',
};

class AccountService extends Service {
  constructor() {
    super();
    this.dependency([
      'jsonSchemaValidationService',
      'dbService',
      'aws',
      'authorizationService',
      'workflowTriggerService',
      'auditWriterService',
    ]);
  }

  async init() {
    await super.init();
    const [dbService] = await this.service(['dbService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);
  }

  async find(requestContext, { id, fields = [] }) {
    // ensure that the caller has permissions to read this account information
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(requestContext, { action: 'read', conditions: [allowIfActive, allowIfAdmin] }, { id });

    const result = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    return this._fromDbToDataObject(result);
  }

  async mustFind(requestContext, { id, fields = [] }) {
    const result = await this.find(requestContext, { id, fields });
    if (!result) throw this.boom.notFound(`Accounts with id "${id}" does not exist`, true);
    return result;
  }

  async provisionAccount(requestContext, rawData) {
    // ensure that the caller has permissions to provision the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'provision', conditions: [allowIfActive, allowIfAdmin] },
      rawData,
    );

    // TODO: prepare all params and pass them down to step and create ready account there
    const [validationService, workflowTriggerService] = await this.service([
      'jsonSchemaValidationService',
      'workflowTriggerService',
    ]);

    // Validate input
    await validationService.ensureValid(rawData, createSchema);

    let appStreamConfig = {};
    if (this.settings.getBoolean(settingKeys.isAppStreamEnabled)) {
      const {
        appStreamFleetDesiredInstances,
        appStreamDisconnectTimeoutSeconds,
        appStreamIdleDisconnectTimeoutSeconds,
        appStreamMaxUserDurationSeconds,
        appStreamImageName,
        appStreamInstanceType,
        appStreamFleetType,
      } = rawData;

      appStreamConfig = {
        appStreamFleetDesiredInstances,
        appStreamDisconnectTimeoutSeconds,
        appStreamIdleDisconnectTimeoutSeconds,
        appStreamMaxUserDurationSeconds,
        appStreamImageName,
        appStreamInstanceType,
        appStreamFleetType,
      };
      const undefinedAppStreamParams = Object.keys(appStreamConfig).filter(key => {
        return appStreamConfig[key] === undefined;
      });
      if (undefinedAppStreamParams.length > 0) {
        throw this.boom.badRequest(
          `Not all required App Stream params are defined. These params need to be defined: ${undefinedAppStreamParams.join(
            ',',
          )}`,
          true,
        );
      }
    }
    const { accountName, accountEmail, masterRoleArn, externalId, description } = rawData;

    // Check launch pre-requisites
    if (!(accountName && accountEmail && masterRoleArn && externalId && description)) {
      const cause = this.getConfigError(accountName, accountEmail, masterRoleArn, externalId, description);
      throw this.boom.badRequest(
        `Creating AWS account process has not been correctly configured: missing ${cause}.`,
        true,
      );
    }
    const workflowRoleArn = this.settings.get(settingKeys.workflowRoleArn);
    const apiHandlerArn = this.settings.get(settingKeys.apiHandlerArn);
    const aws = await this.service('aws');
    const { Account: callerAccountId } = await new aws.sdk.STS({ apiVersion: '2011-06-15' })
      .getCallerIdentity()
      .promise();

    // trigger the provision environment workflow
    // TODO: remove CIDR default once its in the gui and backend
    const input = {
      requestContext,
      accountName,
      accountEmail,
      masterRoleArn,
      externalId,
      description,
      workflowRoleArn,
      apiHandlerArn,
      callerAccountId,
      ...appStreamConfig,
    };
    await workflowTriggerService.triggerWorkflow(requestContext, { workflowId: 'wf-provision-account' }, input);

    // Write audit event
    await this.audit(requestContext, { action: 'provision-account', body: { accountName, accountEmail, description } });
  }

  async saveAccountToDb(requestContext, rawData, id, status = 'PENDING') {
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');
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
    let dbResult;
    try {
      dbResult = await runAndCatch(
        async () => {
          return this._updater()
            .condition('attribute_not_exists(id)') // yes we need this
            .key({ id })
            .item(dbObject)
            .update();
        },
        async () => {
          throw this.boom.badRequest(`account with id "${id}" already exists`, true);
        },
      );
    } catch (error) {
      this.log.log(error);
    }
    return dbResult;
  }

  async update(requestContext, rawData) {
    // ensure that the caller has permissions to update the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [allowIfActive, allowIfAdmin] },
      rawData,
    );

    // Validate the input
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    await jsonSchemaValidationService.ensureValid(rawData, updateSchema);

    const by = _.get(requestContext, 'principalIdentifier.uid');

    // Prepare the db object
    const existingAccount = await this.mustFind(requestContext, { id: rawData.id });
    const mergedCfnInfo = _.assign({}, existingAccount.cfnInfo, rawData.cfnInfo);
    const updatedAccount = _.omit(_.assign({}, existingAccount, rawData, { cfnInfo: mergedCfnInfo }), ['id']);
    const dbObject = this._fromRawToDbObject(updatedAccount, {
      updatedBy: by,
      updatedAt: new Date().toISOString(),
    });

    // Time to save the the db object
    const result = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id: rawData.id })
          .item(dbObject)
          .update();
      },
      async () => {
        throw this.boom.notFound(`environment with id "${rawData.id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-account', body: rawData });

    return result;
  }

  async delete(requestContext, { id }) {
    // ensure that the caller has permissions to delete the account
    // Perform default condition checks to make sure the user is active and is admin
    await this.assertAuthorized(
      requestContext,
      { action: 'delete', conditions: [allowIfActive, allowIfAdmin] },
      { id },
    );

    // Lets now remove the item from the database
    const result = await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(id)') // yes we need this
          .key({ id })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`awsAccounts with id "${id}" does not exist`, true);
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'delete-account', body: { id } });

    return result;
  }

  getConfigError(cfnExecutionRole, roleExternalId, accountId, vpcId, subnetId) {
    const causes = [];

    if (!cfnExecutionRole) causes.push('IAM role');
    if (!roleExternalId) causes.push('External ID');
    if (!accountId) causes.push('AWS account ID');
    if (!vpcId) causes.push('VPC ID');
    if (!subnetId) causes.push('VPC Subnet ID');

    if (causes.length > 1) {
      const last = causes.pop();
      return `${causes.join(', ')} and ${last}`;
    }
    if (causes.length > 0) {
      return causes[0];
    }
    return undefined;
  }

  async list(requestContext, { fields = [] } = {}) {
    const restrict =
      isExternalGuest(requestContext) || isExternalResearcher(requestContext) || isInternalGuest(requestContext);

    if (restrict) return [];

    // Future task: add further checks

    // Remember doing a scan is not a good idea if you billions of rows
    return this._scanner()
      .limit(1000)
      .projection(fields)
      .scan();
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
      { extensionPoint: 'account-authz', action, conditions },
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

module.exports = AccountService;
