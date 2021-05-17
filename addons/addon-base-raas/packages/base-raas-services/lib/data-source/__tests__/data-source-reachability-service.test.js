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
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

// Mocked services
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-workflow-core/lib/workflow/workflow-trigger-service');
jest.mock('../../study/study-service');
jest.mock('../data-source-account-service');
jest.mock('../access-strategy/roles-only/application-role-service');

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const WorkflowTriggerService = require('@aws-ee/base-workflow-core/lib/workflow/workflow-trigger-service');
const StudyService = require('../../study/study-service');
const DataSourceAccountService = require('../data-source-account-service');
const ApplicationRoleService = require('../access-strategy/roles-only/application-role-service');
const DataSourceReachabilityService = require('../data-source-reachability-service');

describe('DataSourceBucketService', () => {
  let service;
  let workflowTriggerService;
  let dataSourceAccountService;
  let studyService;
  const workflowIds = {
    bulkCheck: 'wf-bulk-reachability-check',
    accountStatusChange: 'wf-ds-account-status-change',
  };

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('settings', new SettingsService());
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('studyService', new StudyService());
    container.register('workflowTriggerService', new WorkflowTriggerService());
    container.register('dataSourceAccountService', new DataSourceAccountService());
    container.register('roles-only/applicationRoleService', new ApplicationRoleService());
    container.register('dataSourceReachabilityService', new DataSourceReachabilityService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    await container.initServices();

    service = await container.find('dataSourceReachabilityService');
    workflowTriggerService = await container.find('workflowTriggerService');
    dataSourceAccountService = await container.find('dataSourceAccountService');
    studyService = await container.find('studyService');
  });

  describe('reach scenarios', () => {
    it('calls attemptReach for wildcard without any errors if status is reachable', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '*', status: 'reachable' };

      service.bulkReach = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(service.bulkReach).toHaveBeenCalledWith(
        requestContext,
        { status: params.status },
        { forceCheckAll: false },
      );
    });

    it('calls attemptReach for wildcard without any errors if status is error', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '*', status: 'error' };

      service.bulkReach = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(service.bulkReach).toHaveBeenCalledWith(
        requestContext,
        { status: params.status },
        { forceCheckAll: false },
      );
    });

    it('calls attemptReach for wildcard without any errors', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '*', status: 'pending' };

      service.bulkReach = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(service.bulkReach).toHaveBeenCalledWith(
        requestContext,
        { status: params.status },
        { forceCheckAll: false },
      );
    });

    it('calls attemptReach for dsAccount without any errors', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleAccountId', type: 'dsAccount' };

      service.reachDsAccount = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(service.reachDsAccount).toHaveBeenCalledWith(requestContext, params, { forceCheckAll: false });
    });

    it('calls attemptReach for study without any errors', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleStudyId', type: 'study' };

      service.reachStudy = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(service.reachStudy).toHaveBeenCalledWith(requestContext, params);
    });

    it('fails because type declared with wildcard id', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '*', type: 'dsAccount', status: 'pending' };

      await expect(service.attemptReach(requestContext, params)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('fails because status declared with non-wildcard id', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleAccountId', type: 'dsAccount', status: 'pending' };

      await expect(service.attemptReach(requestContext, params)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true }),
      );
    });

    it('calls bulkReach with wildcard id during forceCheck', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '*' };
      const forceCheckAll = true;
      const dsAccountIds = [{ id: 'sampleDsAccountsId' }];

      workflowTriggerService.triggerWorkflow = jest.fn();
      jest.spyOn(service, 'bulkReach');
      service._getDsAccountsWithStatus = jest.fn().mockResolvedValue(dsAccountIds);

      await service.attemptReach(requestContext, params, { forceCheckAll });

      expect(service.bulkReach).toHaveBeenCalledWith(requestContext, { status: undefined }, { forceCheckAll: true });

      expect(workflowTriggerService.triggerWorkflow).toHaveBeenCalledWith(
        requestContext,
        { workflowId: workflowIds.bulkCheck },
        {
          status: '*',
          forceCheckAll,
          requestContext,
          dsAccountIds,
        },
      );
    });

    it('calls to reach DsAccount for reachable accounts are successful', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleDsAccountId', type: 'dsAccount' };
      const dataSourceAccount = { id: 'sampleDsAccountId' };

      service._checkDsAccountAvailability = jest.fn().mockResolvedValue({ reachable: true, unreachableAppRoles: [] });
      workflowTriggerService.triggerWorkflow = jest.fn();
      dataSourceAccountService.mustFind = jest.fn().mockResolvedValue(dataSourceAccount);
      dataSourceAccountService.updateStatus = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(dataSourceAccountService.updateStatus).toHaveBeenCalledWith(requestContext, dataSourceAccount, {
        status: 'reachable',
        statusMsg: '',
      });
      expect(workflowTriggerService.triggerWorkflow).toHaveBeenCalledWith(
        requestContext,
        { workflowId: workflowIds.accountStatusChange },
        {
          id: params.id,
          type: params.type,
          requestContext,
        },
      );
    });

    it('calls to DsAccount for pending DsAccounts are successful', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleDsAccountId', type: 'dsAccount' };
      const dataSourceAccount = { id: 'sampleDsAccountId', status: 'pending' };

      service._checkDsAccountAvailability = jest.fn().mockResolvedValue(false);
      dataSourceAccountService.mustFind = jest.fn().mockResolvedValue(dataSourceAccount);
      dataSourceAccountService.updateStatus = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(dataSourceAccountService.updateStatus).toHaveBeenCalledWith(requestContext, dataSourceAccount, {
        status: 'pending',
        statusMsg: `WARN|||Data source account ${params.id} is not reachable yet`,
      });
    });

    it('calls to DsAccount for errored out DsAccounts are successful', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleDsAccountId', type: 'dsAccount' };
      const dataSourceAccount = { id: 'sampleDsAccountId' };

      service._checkDsAccountAvailability = jest.fn().mockResolvedValue(false);
      dataSourceAccountService.mustFind = jest.fn().mockResolvedValue(dataSourceAccount);
      dataSourceAccountService.updateStatus = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(dataSourceAccountService.updateStatus).toHaveBeenCalledWith(requestContext, dataSourceAccount, {
        status: 'error',
        statusMsg: `ERR|||Error getting information from data source account ${params.id}`,
      });
    });

    it('calls to study for reachable studies are successful', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleStudyId', type: 'study' };
      const dataSourceStudy = { id: 'sampleStudyId', status: 'pending', appRoleArn: 'sampleAppRoleArn' };

      service._assumeAppRole = jest.fn().mockResolvedValue(true);
      studyService.mustFind = jest.fn().mockResolvedValue(dataSourceStudy);
      studyService.updateStatus = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(studyService.updateStatus).toHaveBeenCalledWith(requestContext, dataSourceStudy, {
        status: 'reachable',
        statusMsg: '',
      });
    });

    it('calls to study for pending studies are successful', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleStudyId', type: 'study' };
      const dataSourceStudy = { id: 'sampleStudyId', status: 'pending', appRoleArn: 'sampleAppRoleArn' };

      service._assumeAppRole = jest.fn().mockResolvedValue(false);
      studyService.mustFind = jest.fn().mockResolvedValue(dataSourceStudy);
      studyService.updateStatus = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(studyService.updateStatus).toHaveBeenCalledWith(requestContext, dataSourceStudy, {
        status: 'pending',
        statusMsg: `WARN|||Study ${params.id} is not reachable yet`,
      });
    });

    it('calls to study for errored out studies are successful', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: 'sampleStudyId', type: 'study' };
      const dataSourceStudy = { id: 'sampleStudyId', status: 'error', appRoleArn: 'sampleAppRoleArn' };

      service._assumeAppRole = jest.fn().mockResolvedValue(false);
      studyService.mustFind = jest.fn().mockResolvedValue(dataSourceStudy);
      studyService.updateStatus = jest.fn();

      await service.attemptReach(requestContext, params);

      expect(studyService.updateStatus).toHaveBeenCalledWith(requestContext, dataSourceStudy, {
        status: 'error',
        statusMsg: `ERR|||Error getting information from study ${params.id}`,
      });
    });

    it('fails because id is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '<**>', status: 'pending' };

      await expect(service.attemptReach(requestContext, params)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because id is empty', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '', status: 'pending' };

      await expect(service.attemptReach(requestContext, params)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because id is too long (101 chars)', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = {
        id:
          'asdfjasuihfwiruhglkajfbmznbvlkjfhiruhalksjbmxncbvlsjkfghirwuygasjhbvmxznbflashjwiuyralsjkhgsbhfgdzxasdfasdfc',
        status: 'pending',
      };

      await expect(service.attemptReach(requestContext, params)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because type is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '*', type: 'teapot' };

      await expect(service.attemptReach(requestContext, params)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('fails because status is invalid', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid } };
      const params = { id: '*', status: 'teapot' };

      await expect(service.attemptReach(requestContext, params)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });
});
