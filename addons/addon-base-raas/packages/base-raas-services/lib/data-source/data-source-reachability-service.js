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
      'roles-only/applicationRoleService',
    ]);
  }

  async bulkReach(requestContext, { status }, { forceCheckAll = false } = {}) {
    status = status || '*';
    const workflowTriggerService = await this.service('workflowTriggerService');
    await workflowTriggerService.triggerWorkflow(
      requestContext,
      { workflowId: workflowIds.bulkCheck },
      {
        status,
        forceCheckAll,
      },
    );
    // Write audit event
    await this.audit(requestContext, {
      action: 'bulk-check-reachability',
      body: { status },
    });
  }

  async reachDsAccount(requestContext, { id, type }, { forceCheck = false } = {}) {
    const accountService = await this.service('dataSourceAccountService');
    const dataSourceAccount = await accountService.mustFind(requestContext, { id });

    const prevStatus = dataSourceAccount.status;
    let newStatus;
    let statusMsg;

    const { reachable, unreachableAppRoles } = await this._checkDsAccountAvailability(dataSourceAccount);

    if (reachable) {
      newStatus = 'reachable';
      statusMsg = '';
    } else if (prevStatus === 'pending') {
      newStatus = prevStatus;
      statusMsg = `WARN|||Data source account ${id} is not reachable yet`;
    } else {
      newStatus = 'error';
      statusMsg = `ERR|||Error getting information from data source account ${id}`;
    }
    if (prevStatus !== newStatus || forceCheck) {
      const workflowTriggerService = await this.service('workflowTriggerService');
      await workflowTriggerService.triggerWorkflow(
        requestContext,
        { workflowId: workflowIds.accountStatusChange },
        {
          id,
          type,
        },
      );
    }
    if (_.isArray(unreachableAppRoles) && unreachableAppRoles.length > 0) {
      statusMsg = `ERR|||Error getting information from ${unreachableAppRoles.length} application roles. 
      Please update the cloudformation template on data source account ${id}`;
    }
    await accountService.updateStatus(requestContext, dataSourceAccount, { status: newStatus, statusMsg });
    const outputVal = { status: newStatus, statusMsg };

    // Write audit event
    await this.audit(requestContext, {
      action: 'check-dsAccount-reachability',
      body: { id, type },
    });

    return outputVal;
  }

  async reachStudy(requestContext, { id, type }) {
    const studyService = await this.service('studyService');
    const studyEntity = await studyService.mustFind(requestContext, id);

    if (!studyEntity.status) {
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
    await studyService.updateStatus(requestContext, studyEntity, { status: newStatus, statusMsg });
    const outputVal = { status: newStatus, statusMsg };

    // Write audit event
    await this.audit(requestContext, {
      action: 'check-study-reachability',
      body: { id, type },
    });

    return outputVal;
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
    }
    reachable = true;
    return { reachable, unreachableAppRoles };
  }

  async _assumeAppRole(studyEntity) {
    const aws = await this.service('aws');
    let reachable = false;
    try {
      const s3Client = await aws.getClientSdkForRole({
        roleArn: studyEntity.appRoleArn,
        clientName: 'S3',
        options: { region: studyEntity.region },
      });
      // use s3Client to read the head of an object
      await s3Client.headObject({ Bucket: studyEntity.bucket, Key: studyEntity.folder });
      reachable = true;
    } catch (err) {
      // Error is expected if assuming role is not successful yet
      reachable = false;
    }
    return reachable;
  }

  async attemptReach(requestContext, { id, status, type }, { forceCheckAll = false } = {}) {
    const accountService = await this.service('dataSourceAccountService');
    await accountService.assertAuthorized(
      requestContext,
      { action: 'update', conditions: [allowIfActive, allowIfAdmin] },
      { id, status, type },
    );

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
