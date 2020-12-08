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

const extensionPoint = 'study-access-strategy';

const workflowIds = {
  bulkCheck: 'wf-bulk-reachability-check',
  accountStatusChange: 'wf-ds-account-status-change',
};

class DataSourceRegistrationService extends Service {
  constructor() {
    super();
    this.dependency([
      'auditWriterService',
      'dataSourceAccountService',
      'dataSourceBucketService',
      'studyService',
      'studyPermissionService',
      'pluginRegistryService',
      'workflowTriggerService',
    ]);
  }

  async registerAccount(requestContext, rawAccountEntity) {
    // We delegate to the data source account service
    const [accountService] = await this.service(['dataSourceAccountService']);

    return accountService.register(requestContext, rawAccountEntity);
  }

  async registerBucket(requestContext, accountId, rawBucketEntity) {
    // We delegate most of the work to the DataSourceBuckService including input validation.
    const [accountService, bucketService] = await this.service(['dataSourceAccountService', 'dataSourceBucketService']);
    const accountEntity = await accountService.mustFind(requestContext, { id: accountId });

    return bucketService.register(requestContext, accountEntity, rawBucketEntity);
  }

  async registerStudy(requestContext, accountId, bucketName, rawStudyEntity) {
    const [accountService, bucketService, studyService] = await this.service([
      'dataSourceAccountService',
      'dataSourceBucketService',
      'studyService',
    ]);

    const accountEntity = await accountService.mustFind(requestContext, { id: accountId });
    const bucketEntity = await bucketService.mustFind(requestContext, { accountId, name: bucketName });
    const studyEntity = await studyService.register(requestContext, accountEntity, bucketEntity, rawStudyEntity);

    // We give a chance to the plugins to participate in the logic of registration. This helps us have different
    // study access strategies
    const pluginRegistryService = await this.service('pluginRegistryService');
    const result = await pluginRegistryService.visitPlugins(extensionPoint, 'onStudyRegistration', {
      payload: {
        requestContext,
        container: this.container,
        accountEntity,
        bucketEntity,
        studyEntity,
      },
    });

    // Write audit event
    await this.audit(requestContext, {
      action: 'register-study',
      body: { accountEntity: result.accountEntity, bucketEntity: result.bucketEntity, studyEntity: result.studyEntity },
    });

    return result.studyEntity;
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
    let outputVal;
    if (!dataSourceAccount.status) {
      throw this.boom.badRequest('Can only check reachability for data source account', true);
    }
    const prevStatus = dataSourceAccount.status;

    // TODO: Use the cloudformation stack name to access its status in the data source account
    // TODO: Determine if the stack is compliant
    // For now, assume CfN stack is ready
    const reachable = true;

    if (reachable) {
      const newStatus = 'reachable';
      await accountService.updateStatus(requestContext, dataSourceAccount, { status: newStatus, statusMsg: '' });
      outputVal = newStatus;
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
      const statusMsg = `WARN|||Data source account ${id} is not reachable yet`;
      await accountService.updateStatus(requestContext, dataSourceAccount, { status: prevStatus, statusMsg });
      outputVal = prevStatus;
    } else {
      const statusMsg = `ERR|||Error getting information from data source account ${id}`;
      await accountService.updateStatus(requestContext, dataSourceAccount, { status: prevStatus, statusMsg });
      outputVal = prevStatus;
    }
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
    let outputVal;
    if (!studyEntity.status) {
      throw this.boom.badRequest('Can only check reachability for data source account studies', true);
    }
    const prevStatus = studyEntity.status;

    // TODO: Assume the application role, it is now able to access the study
    // For now, assume study is reachable
    const reachable = true;

    if (reachable) {
      const newStatus = 'reachable';
      await studyService.updateStatus(requestContext, studyEntity, { status: newStatus, statusMsg: '' });
      outputVal = newStatus;
    } else if (prevStatus === 'pending') {
      const statusMsg = `WARN|||Study ${id} is not reachable yet`;
      await studyService.updateStatus(requestContext, studyEntity, { status: prevStatus, statusMsg });
      outputVal = prevStatus;
    } else {
      const statusMsg = `ERR|||Error getting information from study ${id}`;
      await studyService.updateStatus(requestContext, studyEntity, { status: prevStatus, statusMsg });
      outputVal = prevStatus;
    }
    // Write audit event
    await this.audit(requestContext, {
      action: 'check-study-reachability',
      body: { id, type },
    });
    return outputVal;
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

module.exports = DataSourceRegistrationService;
