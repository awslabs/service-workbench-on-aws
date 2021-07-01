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
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');
const attemptReachSchema = require('../schema/attempt-reach-data-source');

const workflowIds = {
  bulkCheck: 'wf-bulk-reachability-check',
  accountStatusChange: 'wf-ds-account-status-change',
};

class DataSourceReachabilityService extends Service {
  constructor() {
    super();
    this.dependency([
      'auditWriterService',
      'dataSourceAccountService',
      'studyService',
      'workflowTriggerService',
      'aws',
      'jsonSchemaValidationService',
      'roles-only/applicationRoleService',
    ]);
  }

  async bulkReach(requestContext, { status }, { forceCheckAll = false } = {}) {
    status = status || '*';
    const workflowTriggerService = await this.service('workflowTriggerService');
    const dsAccountIds = await this._getDsAccountsWithStatus(requestContext, status);

    if (!_.isEmpty(dsAccountIds)) {
      // TODO: Remove this condition to make it more scalable in the future.
      // This is due to workflow payload having a size limit of 32k. Possible solutions:
      // 1. Could chunk the total list and process ~100 IDs at a time
      // 2. Could also store the IDs in an S3 object and then have the workflow use that object
      if (dsAccountIds.length > 1000) {
        throw this.boom.badRequest(
          'Currently we can only check reachability for a maximum of 1000 data source accounts at a time',
          true,
        );
      }
      await workflowTriggerService.triggerWorkflow(
        requestContext,
        { workflowId: workflowIds.bulkCheck },
        {
          requestContext,
          status,
          dsAccountIds,
          forceCheckAll,
        },
      );
    }
    // Write audit event
    await this.audit(requestContext, {
      action: 'bulk-check-reachability',
      body: { status, dsAccountIds, forceCheckAll },
    });
  }

  async reachDsAccount(requestContext, { id, type }, { forceCheckAll = false } = {}) {
    const accountService = await this.service('dataSourceAccountService');
    const dataSourceAccount = await accountService.mustFind(requestContext, { id });

    const prevStatus = dataSourceAccount.status;
    let newStatus;
    let statusMsg;

    const { reachable, unreachableAppRoles } = await this._checkDsAccountAvailability(
      requestContext,
      dataSourceAccount,
    );

    const stackInfo = await this.getAccountStackInfo(requestContext, dataSourceAccount);

    if (reachable) {
      newStatus = 'reachable';
      statusMsg = '';
      if (prevStatus === 'pending') stackInfo.stackCreated = true;
    } else if (prevStatus === 'pending') {
      newStatus = prevStatus;
      statusMsg = `WARN|||Data source account ${id} is not reachable yet`;
    } else {
      newStatus = 'error';
      statusMsg = `ERR|||Error getting information from data source account ${id}`;
    }

    await accountService.updateStackInfo(requestContext, id, stackInfo);

    if (prevStatus !== newStatus || forceCheckAll) {
      const workflowTriggerService = await this.service('workflowTriggerService');
      await workflowTriggerService.triggerWorkflow(
        requestContext,
        { workflowId: workflowIds.accountStatusChange },
        {
          requestContext,
          id,
          type,
        },
      );
    }

    if (!_.isEmpty(unreachableAppRoles)) {
      statusMsg = `ERR|||Error getting information from ${unreachableAppRoles.length} application roles. 
      It is possible that the cloudformation stack deployed in the data source account ${id} is outdated`;
    }

    const entity = await accountService.updateStatus(requestContext, dataSourceAccount, {
      status: newStatus,
      statusMsg,
    });

    // Write audit event
    await this.audit(requestContext, {
      action: 'check-dsAccount-reachability',
      body: { id, type },
    });

    return entity;
  }

  async reachStudy(requestContext, { id, type }) {
    const studyService = await this.service('studyService');
    const studyEntity = await studyService.mustFind(requestContext, id);

    if (!studyEntity.appRoleArn) {
      throw this.boom.badRequest('Can only check reachability for data source account studies', true);
    }

    let newStatus;
    let statusMsg;
    const prevStatus = studyEntity.status;
    const reachable = await this._assumeAppRole(studyEntity);

    if (reachable) {
      newStatus = 'reachable';
      statusMsg = '';
    } else if (prevStatus === 'pending') {
      newStatus = prevStatus;
      statusMsg = `WARN|||Study ${id} is not reachable yet`;
    } else {
      newStatus = 'error';
      statusMsg = `ERR|||Error getting information from study ${id}`;
    }
    const entity = await studyService.updateStatus(requestContext, studyEntity, { status: newStatus, statusMsg });

    // Write audit event
    await this.audit(requestContext, {
      action: 'check-study-reachability',
      body: { id, type },
    });

    return entity;
  }

  async _getDsAccountsWithStatus(requestContext, status) {
    const dataSourceAccountService = await this.service('dataSourceAccountService');
    const dsAccountEntries = await dataSourceAccountService.list(requestContext);
    let dsAccountIds = [];
    if (status === '*') {
      dsAccountIds = _.map(dsAccountEntries, accountEntry => accountEntry.id);
    } else {
      const filteredDsAccounts = _.filter(
        dsAccountEntries,
        accountEntry => accountEntry.status && accountEntry.status === status,
      );
      dsAccountIds = _.map(filteredDsAccounts, accountEntry => accountEntry.id);
    }
    return dsAccountIds;
  }

  async _checkDsAccountAvailability(requestContext, dataSourceAccount) {
    const appRoleService = await this.service('roles-only/applicationRoleService');
    const appRoles = await appRoleService.list(requestContext, dataSourceAccount.id);
    const unreachableAppRoles = [];
    let reachable;
    let status;
    let statusMsg;

    const processor = async appRole => {
      try {
        const aws = await this.service('aws');
        await aws.getCredentialsForRole({
          roleArn: appRole.arn,
        });
        status = 'reachable';
        statusMsg = '';
      } catch (err) {
        unreachableAppRoles.push(appRole);
        status = 'error';
        statusMsg = `ERR|||Error getting information from appRole ${appRole.arn}`;
      } finally {
        appRoleService.updateStatus(requestContext, appRole, { status, statusMsg });
      }
    };

    // Reach out 10 at a time
    await processInBatches(appRoles, 10, processor);

    if (appRoles.length === unreachableAppRoles.length) {
      reachable = false;
    } else {
      reachable = true;
    }

    return { reachable, unreachableAppRoles };
  }

  async _assumeAppRole(studyEntity) {
    const aws = await this.service('aws');

    try {
      const s3Client = await aws.getClientSdkForRole({
        roleArn: studyEntity.appRoleArn,
        clientName: 'S3',
        options: { region: studyEntity.region },
      });

      // The logic:
      // - We first check if we are trying to reach the root folder, if so, then we can't use headObject because
      //   the root folder is actually not an object at all
      // - For non-root folder:
      //   - We first attempt to list the content of the prefix, if we are able to do so then we need to check if
      //     there are any items. Note: this attempt will not throw an exception if the folder does not exist
      //     but it will fail if we don't have read or read/write access to the folder
      //   - If we can't find any item then we need to issue a headObject call this will cover the case that there
      //     is a folder (a 0-byte object) but no content inside the folder.

      const result = await s3Client
        .listObjectsV2({ Bucket: studyEntity.bucket, Prefix: studyEntity.folder, MaxKeys: 2 })
        .promise();

      const hasContent = !_.isEmpty(result.Contents);
      if (hasContent || studyEntity.folder === '/') return true; // We found data, the study is reachable

      // Since we are able to list the prefix but we don't have any content, there is a chance that the study folder
      // does not exist, we will try to see if there is an actual (0-byte object) with the exact name as the folder
      await s3Client.headObject({ Bucket: studyEntity.bucket, Key: studyEntity.folder }).promise();

      return true; // We are able to reach the study
    } catch (err) {
      // Error is expected if assuming role is not successful yet
      return false; // We can't reach the study
    }
  }

  async attemptReach(requestContext, requestBody, { forceCheckAll = false } = {}) {
    const accountService = await this.service('dataSourceAccountService');
    const id = requestBody.id;
    const type = requestBody.type;
    const status = requestBody.status;

    await accountService.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [allowIfActive, allowIfAdmin] },
      { id, status, type },
    );

    // Validate input
    const [validationService] = await this.service(['jsonSchemaValidationService']);
    await validationService.ensureValid(requestBody, attemptReachSchema);

    if (!id) {
      throw this.boom.badRequest(`ID is undefined. Please enter a valid dsAccountId, studyId, or '*'`, true);
    }

    if (id === '*' && type) {
      throw this.boom.badRequest(`Cannot process type with wildcard id`, true);
    }

    if (id !== '*' && status) {
      throw this.boom.badRequest(`Can only process status with wildcard id`, true);
    }

    let outputVal;

    if (id === '*') {
      await this.bulkReach(requestContext, { status }, { forceCheckAll });
    } else if (type === 'dsAccount') {
      outputVal = await this.reachDsAccount(requestContext, { id, type }, { forceCheckAll });
    } else if (type === 'study') {
      outputVal = await this.reachStudy(requestContext, { id, type });
    }

    return outputVal;
  }

  // @private
  async getAccountStackInfo(requestContext, accountEntity) {
    const accountService = await this.service('dataSourceAccountService');
    try {
      const result = await accountService.queryStack(requestContext, accountEntity);
      return {
        stackId: result.stackId,
        templateIdFound: result.templateId,
      };
    } catch (_err) {
      return {};
    }
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

module.exports = DataSourceReachabilityService;
