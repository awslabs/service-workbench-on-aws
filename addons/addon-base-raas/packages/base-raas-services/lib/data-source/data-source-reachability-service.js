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

// const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { allowIfActive, allowIfAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

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
    ]);
  }

  async bulkReach(requestContext, { status }) {
    status = status || '*';
    const workflowTriggerService = await this.service('workflowTriggerService');
    await workflowTriggerService.triggerWorkflow(
      requestContext,
      { workflowId: workflowIds.bulkCheck },
      {
        status,
      },
    );
    // Write audit event
    await this.audit(requestContext, {
      action: 'bulk-check-reachability',
      body: { status },
    });
  }

  async reachDsAccount(requestContext, { id, type }) {
    const accountService = await this.service('dataSourceAccountService');
    const dataSourceAccount = await accountService.mustFind(requestContext, { id });

    if (!dataSourceAccount.status) {
      throw this.boom.badRequest('Can only check reachability for data source account', true);
    }
    const prevStatus = dataSourceAccount.status;
    let newStatus = prevStatus;
    let statusMsg = '';

    // TODO: Use the cloudformation stack name to access its status in the data source account
    // TODO: Determine if the stack is compliant
    const reachable = false;

    if (reachable) {
      newStatus = 'reachable';
      if (prevStatus !== newStatus) {
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
    } else if (prevStatus === 'pending') {
      statusMsg = `WARN|||Data source account ${id} is not reachable yet`;
    } else {
      newStatus = 'error';
      statusMsg = `ERR|||Error getting information from data source account ${id}`;
    }
    await accountService.updateStatus(requestContext, dataSourceAccount, { status: newStatus, statusMsg });
    const outputVal = newStatus;

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

    const prevStatus = studyEntity.status;
    let newStatus = prevStatus;
    let statusMsg = '';
    const reachable = await this._assumeAppRole(studyEntity);

    if (reachable) {
      newStatus = 'reachable';
    } else if (prevStatus === 'pending') {
      statusMsg = `WARN|||Study ${id} is not reachable yet`;
    } else {
      statusMsg = `ERR|||Error getting information from study ${id}`;
    }
    await studyService.updateStatus(requestContext, studyEntity, { status: newStatus, statusMsg });
    const outputVal = newStatus;

    // Write audit event
    await this.audit(requestContext, {
      action: 'check-study-reachability',
      body: { id, type },
    });

    return outputVal;
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

  async attemptReach(requestContext, { id, status, type }) {
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
      await this.bulkReach(requestContext, { status });
    } else if (type === 'dsAccount') {
      outputVal = await this.reachDsAccount(requestContext, { id, type });
    } else if (type === 'study') {
      outputVal = await this.reachstudy(requestContext, { id, type });
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
