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
const YAML = require('js-yaml');
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');

jest.mock('@aws-ee/base-services/lib/iam/iam-service.js');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const AWSMock = require('aws-sdk-mock');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const IamService = require('@aws-ee/base-services/lib/iam/iam-service.js');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('../../environment-authz-service.js');
const EnvironmentAuthZServiceMock = require('../../environment-authz-service.js');

jest.mock('../../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');
const WorkflowTriggerServiceMock = require('../../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');

jest.mock('../../../project/project-service');
const ProjectServiceMock = require('../../../project/project-service');

jest.mock('../../../aws-accounts/aws-accounts-service');
const AwsAccountsServiceMock = require('../../../aws-accounts/aws-accounts-service');

jest.mock('../../../indexes/indexes-service');
const IndexesServiceMock = require('../../../indexes/indexes-service');

jest.mock('../../../storage-gateway/storage-gateway-service');
const StorageGatewayService = require('../../../storage-gateway/storage-gateway-service');

jest.mock('../../../study/study-service');
const StudyService = require('../../../study/study-service');

const EnvironmentSCService = require('../environment-sc-service');

const workflowIds = {
  create: 'wf-provision-environment-sc',
  delete: 'wf-terminate-environment-sc',
};

describe('EnvironmentSCService', () => {
  let service = null;
  let dbService = null;
  let projectService = null;
  let indexesService = null;
  let wfService = null;
  let awsAccountsService = null;
  let aws = null;
  let storageGatewayService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('log', new Logger());
    container.register('aws', new AwsService());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('environmentAuthzService', new EnvironmentAuthZServiceMock());
    container.register('workflowTriggerService', new WorkflowTriggerServiceMock());
    container.register('projectService', new ProjectServiceMock());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('indexesService', new IndexesServiceMock());
    container.register('environmentSCService', new EnvironmentSCService());
    container.register('storageGatewayService', new StorageGatewayService());
    container.register('iamService', new IamService());
    container.register('studyService', new StudyService());
    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('environmentSCService');
    dbService = await container.find('dbService');
    projectService = await container.find('projectService');
    indexesService = await container.find('indexesService');
    awsAccountsService = await container.find('awsAccountsService');
    wfService = await container.find('workflowTriggerService');
    aws = await container.find('aws');
    storageGatewayService = await container.find('storageGatewayService');

    // Skip authorization by default
    service.assertAuthorized = jest.fn();

    // Other function mocks
    projectService.mustFind = jest.fn(() => {
      return { indexId: 'exampleIndexId' };
    });
    indexesService.mustFind = jest.fn(() => {
      return { awsAccountId: 'exampleAwsAccountId' };
    });
    awsAccountsService.mustFind = jest.fn(() => {
      return { roleArn: 'cfnExecutionRole', externalId: 'roleExternalId' };
    });
    service._fromRawToDbObject = jest.fn(x => x);
  });

  describe('create function', () => {
    it('should fail because the user is external', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: true,
        },
      };
      const newEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
      };

      // OPERATE
      try {
        await service.create(requestContext, newEnv);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'forbidden')).toBe(true);
        expect(err.message).toContain('not authorized');
      }
    });

    it('should fail because the environment is missing an envTypeConfigId', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: false,
        },
      };
      const newEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
      };

      // OPERATE
      try {
        await service.create(requestContext, newEnv);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toBe('Input has validation errors');
      }
    });

    it('should fail because the environment already exists', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: false,
        },
      };
      const newEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
      };
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.create(requestContext, newEnv);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain('already exists');
      }
    });

    it('should fail because the workflow failed to trigger', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: false,
        },
      };
      const newEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
      };
      service.audit = jest.fn();
      wfService.triggerWorkflow.mockImplementationOnce(() => {
        throw error;
      });
      service.mustFind = jest.fn().mockImplementationOnce(() => {
        return { rev: 2 };
      });
      // don't want to test update in the create() tests
      service.update = jest.fn();

      // OPERATE
      try {
        await service.create(requestContext, newEnv);
        expect.hasAssertions();
      } catch (err) {
        expect(service.audit).toHaveBeenCalledWith(
          requestContext,
          expect.objectContaining({ action: 'create-environment-sc' }),
        );
        expect(service.boom.is(err, 'internalError')).toBe(true);
        expect(err.message).toContain(`Error triggering ${workflowIds.create} workflow`);
        expect(service.update).toHaveBeenCalled();
      }
    });

    it('should succeed to create the environment and trigger workflow', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: false,
        },
      };
      const newEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
      };
      service.audit = jest.fn();
      wfService.triggerWorkflow = jest.fn();

      // OPERATE
      await service.create(requestContext, newEnv);

      // CHECK
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'create-environment-sc' }),
      );
      expect(wfService.triggerWorkflow).toHaveBeenCalled();
    });
  });

  describe('find', () => {
    it('verify mustFind without defaults', async () => {
      // BUILD
      const uid = 'u-12345';
      const requestContext = { principalIdentifier: { uid } };
      const env = {
        status: 'COMPLETED',
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study1', 'study2'],
      };

      service.find = jest.fn().mockResolvedValueOnce(env);

      // OPERATE
      await service.mustFind(requestContext, { id: 'oldId' });

      // CHECK
      expect(service.find).toHaveBeenCalledWith(requestContext, { id: 'oldId', fields: [], fetchCidr: true });
    });

    it('verify mustFind with fetchCidr', async () => {
      // BUILD
      const uid = 'u-12345';
      const requestContext = { principalIdentifier: { uid } };
      const env = {
        status: 'COMPLETED',
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study1', 'study2'],
      };

      service.find = jest.fn().mockResolvedValueOnce(env);

      // OPERATE
      await service.mustFind(requestContext, { id: 'oldId', fields: [], fetchCidr: false });

      // CHECK
      expect(service.find).toHaveBeenCalledWith(requestContext, { id: 'oldId', fields: [], fetchCidr: false });
    });

    it('verify getSecurityGroupDetails not called when fetchCidr is false', async () => {
      // BUILD
      const uid = 'u-12345';
      const requestContext = { principalIdentifier: { uid } };

      const env = {
        status: 'COMPLETED',
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study1', 'study2'],
      };
      service.audit = jest.fn();
      service.getSecurityGroupDetails = jest.fn();
      dbService.table.get.mockReturnValueOnce(env);

      // OPERATE
      await service.find(requestContext, { id: 'oldId', fetchCidr: false });

      // CHECK
      expect(service.getSecurityGroupDetails).not.toHaveBeenCalled();
      expect(service.assertAuthorized).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'get-sc', conditions: [service._allowAuthorized] }),
        env,
      );
    });

    it('verify getSecurityGroupDetails called by default', async () => {
      // BUILD
      const uid = 'u-12345';
      const requestContext = { principalIdentifier: { uid } };

      const env = {
        status: 'COMPLETED',
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study1', 'study2'],
      };
      service.audit = jest.fn();
      dbService.table.get.mockReturnValueOnce(env);
      service.getSecurityGroupDetails = jest.fn().mockReturnValueOnce([
        {
          fromPort: 3389,
          toPort: 3389,
          protocol: 'tcp',
          cidrBlocks: ['0.0.0.0/0'],
        },
      ]);

      // OPERATE
      await service.find(requestContext, { id: 'oldId' });

      // CHECK
      expect(service.getSecurityGroupDetails).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining(requestContext),
        expect.objectContaining(env),
      );
      expect(service.assertAuthorized).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'get-sc', conditions: [service._allowAuthorized] }),
        env,
      );
    });
  });

  describe('update study roles', () => {
    it('throw error if studyRoleMap is invalid', async () => {
      // BUILD
      const uid = 'u-12345';
      const requestContext = { principalIdentifier: { uid } };

      const env = {
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study1'],
      };
      const studyRoles = {
        study1: 123,
      };
      service.audit = jest.fn();
      service.mustFind = jest.fn().mockResolvedValueOnce(env);

      // OPERATE
      try {
        await service.updateStudyRoles(requestContext, 'oldId', studyRoles);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toBe(
          "The study role map can only contain values of type string and can not be empty. Received incorrect value for the key 'study1'",
        );
      }

      // CHECK
      expect(dbService.table.update).not.toHaveBeenCalled();
      expect(service.mustFind).toHaveBeenNthCalledWith(1, expect.objectContaining(requestContext), {
        id: 'oldId',
        fetchCidr: false,
      });
      expect(service.assertAuthorized).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'update-study-role-map', conditions: [service._allowAuthorized] }),
        env,
      );
    });

    it('should succeed to update study roles', async () => {
      // BUILD
      const uid = 'u-12345';
      const requestContext = { principalIdentifier: { uid } };

      const env = {
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study1', 'study2'],
      };
      const studyRoles = {
        study1: 'arn:aws:iam::012345678900:role/swb-random-fs-1615225782025',
      };
      service.audit = jest.fn();
      service.mustFind = jest.fn().mockResolvedValueOnce(env);

      // OPERATE
      await service.updateStudyRoles(requestContext, 'oldId', studyRoles);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: env.id });
      expect(dbService.table.item).toHaveBeenCalledWith({ studyRoles, updatedBy: uid });
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.mustFind).toHaveBeenNthCalledWith(1, expect.objectContaining(requestContext), {
        id: 'oldId',
        fetchCidr: false,
      });
      expect(service.assertAuthorized).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'update-study-role-map', conditions: [service._allowAuthorized] }),
        env,
      );
    });
  });

  describe('update function', () => {
    it('should fail because the environment is missing a rev value ', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: false,
        },
      };
      const envToUpdate = {
        id: 'exampleId',
      };

      // OPERATE
      try {
        await service.update(requestContext, envToUpdate);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toBe('Input has validation errors');
      }
    });

    it('should fail because the environment does not exist', async () => {
      // BUILD
      const requestContext = {
        principalIdentifier: {
          username: 'uname',
          ns: 'user.ns',
        },
      };

      const oldEnv = {
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
      };

      const newEnv = {
        id: oldEnv.id,
        rev: 2,
      };

      service.mustFind = jest.fn().mockResolvedValueOnce(oldEnv);
      service.find = jest.fn().mockResolvedValueOnce();
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.update(requestContext, newEnv);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'notFound')).toBe(true);
        expect(err.message).toContain('does not exist');
      }
    });

    it('should fail because the environment was already updated server-side', async () => {
      // BUILD
      const requestContext = {
        principalIdentifier: {
          username: 'uname',
          ns: 'user.ns',
        },
      };

      const oldEnv = {
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
      };

      const newEnv = {
        id: oldEnv.id,
        rev: 2,
      };

      service.mustFind = jest.fn().mockResolvedValueOnce(oldEnv);
      service.find = jest.fn().mockResolvedValueOnce(newEnv);
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.update(requestContext, newEnv);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain('environment information changed');
      }
    });

    it('should succeed to update', async () => {
      // BUILD
      const requestContext = {
        principalIdentifier: {
          username: 'uname',
          ns: 'user.ns',
        },
      };

      const oldEnv = {
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study-id-1', 'study-id-2'],
      };

      const newEnv = {
        id: oldEnv.id,
        rev: 2,
      };
      service.audit = jest.fn();
      service.mustFind = jest.fn().mockResolvedValueOnce(oldEnv);

      // OPERATE
      await service.update(requestContext, newEnv);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: newEnv.id });
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'update-environment-sc' }),
      );
      expect(storageGatewayService.updateStudyFileMountIPAllowList).not.toHaveBeenCalled();
    });

    it('should call updateStudyFileMountIPAllowList to update IP when needed', async () => {
      // BUILD
      const requestContext = {
        principalIdentifier: {
          username: 'uname',
          ns: 'user.ns',
        },
      };

      const oldEnv = {
        id: 'oldId',
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        updatedBy: {
          username: 'user',
        },
        studyIds: ['study-id-1', 'study-id-2'],
      };

      const newEnv = {
        id: oldEnv.id,
        rev: 2,
      };
      service.audit = jest.fn();
      service.mustFind = jest.fn().mockResolvedValueOnce(oldEnv);

      // OPERATE
      await service.update(requestContext, newEnv, { action: 'ADD', ip: '1.2.3.4' });

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: newEnv.id });
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'update-environment-sc' }),
      );
      expect(storageGatewayService.updateStudyFileMountIPAllowList).toHaveBeenCalledWith(requestContext, oldEnv, {
        action: 'ADD',
        ip: '1.2.3.4',
      });
    });
  });

  describe('pollAndSyncWsStatus function', () => {
    const sagemakerResponse = {
      NotebookInstances: [
        {
          NotebookInstanceName: 'notebook-instance-name',
          NotebookInstanceStatus: 'Stopped',
        },
      ],
    };
    const requestContext = {
      principalIdentifier: {
        username: 'uname',
        ns: 'user.ns',
      },
    };
    const stsResponse = {
      AccessKeyId: 'accessKeyId',
      SecretAccessKey: 'secretAccessKey',
      SessionToken: 'sessionToken',
    };
    const ec2Response = {
      Reservations: [
        {
          Instances: [
            {
              InstanceId: 'ec2-instance-id',
              State: {
                Name: 'stopped',
              },
            },
          ],
        },
      ],
    };

    it('Should sync EC2 status when stale status is COMPLETED and real time status is stopped', async () => {
      // BUILD
      indexesService.list = jest
        .fn()
        .mockResolvedValue([{ id: 'some-index-id', awsAccountId: 'some-aws-account-uuid' }]);
      awsAccountsService.list = jest.fn().mockResolvedValue([
        {
          roleArn: 'some-role-arn',
          externalId: 'some-external-id',
          id: 'some-aws-account-uuid',
          accountId: 'some-aws-account-id',
        },
      ]);
      dbService.table.scan.mockResolvedValueOnce([
        {
          id: 'some-environment-id',
          indexId: 'some-index-id',
          status: 'COMPLETED',
          outputs: [{ OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: 'ec2-instance-id' }],
        },
      ]);
      service.update = jest.fn();
      AWSMock.setSDKInstance(aws.sdk);
      AWSMock.mock('STS', 'assumeRole', { Credentials: stsResponse });
      AWSMock.mock('EC2', 'describeInstances', ec2Response);

      // OPERATE
      const result = await service.pollAndSyncWsStatus(requestContext);
      expect(result).toMatchObject([
        {
          accountId: 'some-aws-account-id',
          ec2Updated: {
            'ec2-instance-id': { currentStatus: 'STOPPED', ddbID: 'some-environment-id', staleStatus: 'COMPLETED' },
          },
          sagemakerUpdated: {},
        },
      ]);
      // CHECK
      AWSMock.restore();
    });

    it('Should not sync EC2 status when stale status is STARTING and inWorkflow is true', async () => {
      // BUILD
      indexesService.list = jest
        .fn()
        .mockResolvedValue([{ id: 'some-index-id', awsAccountId: 'some-aws-account-uuid' }]);
      awsAccountsService.list = jest.fn().mockResolvedValue([
        {
          roleArn: 'some-role-arn',
          externalId: 'some-external-id',
          id: 'some-aws-account-uuid',
          accountId: 'some-aws-account-id',
        },
      ]);
      dbService.table.scan.mockResolvedValueOnce([
        {
          id: 'some-environment-id',
          indexId: 'some-index-id',
          status: 'COMPLETED',
          outputs: [{ OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: 'ec2-instance-id' }],
          inWorkflow: 'true',
        },
      ]);
      service.update = jest.fn();

      AWSMock.setSDKInstance(aws.sdk);
      AWSMock.mock('STS', 'assumeRole', { Credentials: stsResponse });
      AWSMock.mock('EC2', 'describeInstances', ec2Response);

      // OPERATE
      const result = await service.pollAndSyncWsStatus(requestContext);
      // CHECK
      expect(result).toMatchObject([
        {
          accountId: 'some-aws-account-id',
          ec2Updated: {},
          sagemakerUpdated: {},
        },
      ]);
      AWSMock.restore();
    });

    it('Should continue to update other workspace status if one update errors out', async () => {
      // BUILD
      indexesService.list = jest
        .fn()
        .mockResolvedValue([{ id: 'some-index-id', awsAccountId: 'some-aws-account-uuid' }]);
      awsAccountsService.list = jest.fn().mockResolvedValue([
        {
          roleArn: 'some-role-arn',
          externalId: 'some-external-id',
          id: 'some-aws-account-uuid',
          accountId: 'some-aws-account-id',
        },
      ]);
      dbService.table.scan.mockResolvedValueOnce([
        {
          id: 'some-environment-id',
          indexId: 'some-index-id',
          status: 'COMPLETED',
          outputs: [{ OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: 'ec2-instance-id' }],
        },
        {
          id: 'some-environment-id',
          indexId: 'some-index-id',
          status: 'STOPPING',
          outputs: [{ OutputKey: 'NotebookInstanceName', OutputValue: 'notebook-instance-name' }],
        },
      ]);
      service.update = jest.fn().mockImplementationOnce(() => {
        throw Error(`environment information changed just before your request is processed, please try again`);
      });
      AWSMock.setSDKInstance(aws.sdk);
      AWSMock.mock('STS', 'assumeRole', { Credentials: stsResponse });
      AWSMock.mock('EC2', 'describeInstances', ec2Response);
      AWSMock.mock('SageMaker', 'listNotebookInstances', sagemakerResponse);

      // OPERATE
      const result = await service.pollAndSyncWsStatus(requestContext);
      // CHECK
      expect(result).toMatchObject([
        {
          accountId: 'some-aws-account-id',
          ec2Updated: {},
          sagemakerUpdated: {
            'notebook-instance-name': {
              currentStatus: 'STOPPED',
              ddbID: 'some-environment-id',
              staleStatus: 'STOPPING',
            },
          },
        },
      ]);
      AWSMock.restore();
    });

    it('Should sync SageMaker status when stale status is STOPPING(not in workflow) and real time status is stopped', async () => {
      // BUILD
      indexesService.list = jest
        .fn()
        .mockResolvedValue([{ id: 'some-index-id', awsAccountId: 'some-aws-account-uuid' }]);
      awsAccountsService.list = jest.fn().mockResolvedValue([
        {
          roleArn: 'some-role-arn',
          externalId: 'some-external-id',
          id: 'some-aws-account-uuid',
          accountId: 'some-aws-account-id',
        },
      ]);
      dbService.table.scan.mockResolvedValueOnce([
        {
          id: 'some-environment-id',
          indexId: 'some-index-id',
          status: 'STOPPING',
          outputs: [{ OutputKey: 'NotebookInstanceName', OutputValue: 'notebook-instance-name' }],
        },
      ]);
      service.update = jest.fn();

      AWSMock.setSDKInstance(aws.sdk);
      AWSMock.mock('STS', 'assumeRole', { Credentials: stsResponse });
      AWSMock.mock('SageMaker', 'listNotebookInstances', sagemakerResponse);

      // OPERATE
      const result = await service.pollAndSyncWsStatus(requestContext);
      // CHECK
      expect(result).toMatchObject([
        {
          accountId: 'some-aws-account-id',
          ec2Updated: {},
          sagemakerUpdated: {
            'notebook-instance-name': {
              currentStatus: 'STOPPED',
              ddbID: 'some-environment-id',
              staleStatus: 'STOPPING',
            },
          },
        },
      ]);
      AWSMock.restore();
    });

    it('Should call listNotebookInstances with NextToken if NextToken is returned', async () => {
      // BUILD
      indexesService.list = jest
        .fn()
        .mockResolvedValue([{ id: 'some-index-id', awsAccountId: 'some-aws-account-uuid' }]);
      awsAccountsService.list = jest.fn().mockResolvedValue([
        {
          roleArn: 'some-role-arn',
          externalId: 'some-external-id',
          id: 'some-aws-account-uuid',
          accountId: 'some-aws-account-id',
        },
      ]);
      dbService.table.scan.mockResolvedValueOnce([
        {
          id: 'some-environment-id',
          indexId: 'some-index-id',
          status: 'STOPPING',
          outputs: [{ OutputKey: 'NotebookInstanceName', OutputValue: 'notebook-instance-name' }],
        },
        {
          id: 'some-environment-id-1',
          indexId: 'some-index-id',
          status: 'STOPPING',
          outputs: [{ OutputKey: 'NotebookInstanceName', OutputValue: 'notebook-instance-name-1' }],
        },
        {
          id: 'some-environment-id-2',
          indexId: 'some-index-id',
          status: 'STOPPING',
          outputs: [{ OutputKey: 'NotebookInstanceName', OutputValue: 'notebook-instance-name-2' }],
        },
      ]);
      service.update = jest.fn();

      AWSMock.setSDKInstance(aws.sdk);
      AWSMock.mock('STS', 'assumeRole', { Credentials: stsResponse });
      const mockListNotebookInstance = jest
        .fn()
        .mockImplementationOnce((params, callback) => {
          callback(null, {
            NotebookInstances: [
              {
                NotebookInstanceName: 'notebook-instance-name',
                NotebookInstanceStatus: 'Stopped',
              },
              {
                NotebookInstanceName: 'notebook-instance-name-1',
                NotebookInstanceStatus: 'InService',
              },
            ],
            NextToken: 'some-next-token',
          });
        })
        .mockImplementationOnce((params, callback) => {
          if (params.NextToken === 'some-next-token') {
            callback(null, {
              NotebookInstances: [
                {
                  NotebookInstanceName: 'notebook-instance-name-2',
                  NotebookInstanceStatus: 'Updating',
                },
              ],
            });
          } else {
            callback({ message: 'NextToken is different from expected' }, null);
          }
        })
        .mockImplementationOnce((params, callback) => {
          callback({ message: `list notebook was called the third time, only 2 calls expected` }, null);
        });
      AWSMock.mock('SageMaker', 'listNotebookInstances', mockListNotebookInstance);

      // OPERATE
      const result = await service.pollAndSyncWsStatus(requestContext);
      // CHECK
      expect(result).toMatchObject([
        {
          accountId: 'some-aws-account-id',
          ec2Updated: {},
          sagemakerUpdated: {
            'notebook-instance-name': {
              currentStatus: 'STOPPED',
              ddbID: 'some-environment-id',
              staleStatus: 'STOPPING',
            },
            'notebook-instance-name-1': {
              currentStatus: 'COMPLETED',
              ddbID: 'some-environment-id-1',
              staleStatus: 'STOPPING',
            },
            'notebook-instance-name-2': {
              currentStatus: 'STARTING',
              ddbID: 'some-environment-id-2',
              staleStatus: 'STOPPING',
            },
          },
        },
      ]);
      AWSMock.restore();
    });
  });

  describe('changeWorkspaceRunState function', () => {
    it('Should throw bad request exception when trying to stop an instance NOT in COMPLETED status', async () => {
      // BUILD
      const requestContext = {
        principalIdentifier: {
          username: 'uname',
          ns: 'user.ns',
        },
      };

      const oldEnv = {
        status: 'STOPPING',
      };

      service.mustFind = jest.fn().mockResolvedValueOnce(oldEnv);

      // OPERATE
      try {
        await service.changeWorkspaceRunState(requestContext, { id: '1234567', operation: 'stop' });
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain('unable to stop environment with id "1234567" - current status "STOPPING"');
      }
    });

    it('Should throw bad request exception when trying to stop an instance other than Sagemaker or EC2', async () => {
      // BUILD
      const requestContext = {
        principalIdentifier: {
          username: 'uname',
          ns: 'user.ns',
        },
      };

      const oldEnv = {
        status: 'COMPLETED',
        outputs: [],
      };

      service.mustFind = jest.fn().mockResolvedValueOnce(oldEnv);

      // OPERATE
      try {
        await service.changeWorkspaceRunState(requestContext, { id: '1234567', operation: 'stop' });
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain(
          'unable to stop environment with id "1234567" - operation only supported for sagemaker and EC2 environemnt.',
        );
      }
    });

    it('Should call the correct workflow with the correct inputs', async () => {
      // BUILD
      const requestContext = {
        principalIdentifier: {
          username: 'uname',
          ns: 'user.ns',
        },
      };

      const oldEnv = {
        status: 'STOPPED',
        outputs: [{ OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: 'some-ec2-instance-id' }],
        id: '1234567',
      };

      service.mustFind = jest.fn().mockResolvedValueOnce(oldEnv);

      // OPERATE
      await service.changeWorkspaceRunState(requestContext, { id: '1234567', operation: 'start' });
      expect(wfService.triggerWorkflow).toHaveBeenCalledWith(
        requestContext,
        { workflowId: `wf-start-ec2-environment-sc` },
        expect.objectContaining({ environmentId: '1234567', instanceIdentifier: 'some-ec2-instance-id' }),
      );
    });
  });

  describe('delete function', () => {
    it('should fail because the user is external', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: true,
        },
      };
      const existingEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
      };

      // OPERATE
      try {
        await service.delete(requestContext, { id: existingEnv.id });
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'forbidden')).toBe(true);
        expect(err.message).toContain('not authorized');
      }
    });

    it('should fail because the workflow failed to trigger', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: false,
        },
      };
      const existingEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        indexId: 'exampleIndexId',
      };
      service.mustFind = jest
        .fn()
        .mockResolvedValueOnce(existingEnv)
        .mockResolvedValueOnce({ rev: 2 });
      service.update = jest.fn();
      service.getEnvMgmtRoleInfoForIndex = jest.fn().mockResolvedValueOnce({
        xAccEnvMgmtRoleArn: 'arn:xxxxxxxxx',
        externalId: 'xId',
      });

      wfService.triggerWorkflow.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.delete(requestContext, { id: existingEnv.id });
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'internalError')).toBe(true);
        expect(err.message).toContain(`Error triggering ${workflowIds.delete} workflow`);
      }
    });

    it('should succeed to delete the environment', async () => {
      // BUILD
      const requestContext = {
        principal: {
          isExternalUser: false,
        },
      };
      const existingEnv = {
        name: 'exampleName',
        envTypeId: 'exampleETI',
        envTypeConfigId: 'exampleETCI',
        indexId: 'exampleIndexId',
      };
      service.mustFind = jest.fn().mockResolvedValueOnce(existingEnv);
      service.update = jest.fn();
      service.getEnvMgmtRoleInfoForIndex = jest.fn().mockResolvedValueOnce({
        xAccEnvMgmtRoleArn: 'arn:xxxxxxxxx',
        externalId: 'xId',
      });
      service.audit = jest.fn();
      wfService.triggerWorkflow = jest.fn();

      // OPERATE
      await service.delete(requestContext, { id: existingEnv.id });

      // CHECK
      expect(wfService.triggerWorkflow).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'delete-environment-sc' }),
      );
    });
  });

  describe('getSecurityGroupDetails function', () => {
    it('should send filtered security group rules as expected', async () => {
      // BUILD
      const requestContext = {};
      const stackArn = 'sampleCloudFormationStackArn';
      const environment = {
        outputs: [{ OutputKey: 'CloudformationStackARN', OutputValue: `<AwsAccountRoot>/${stackArn}` }],
        status: 'COMPLETED',
      };
      const origSecurityGroupId = 'sampleSecurityGroupId';
      const stackResources = {
        StackResourceSummaries: [{ LogicalResourceId: 'SecurityGroup', PhysicalResourceId: origSecurityGroupId }],
      };
      const templateDetails = {
        TemplateBody: YAML.dump({
          Resources: {
            SecurityGroup: {
              Properties: {
                SecurityGroupIngress: [
                  {
                    IpProtocol: 'tcp',
                    FromPort: 123,
                    ToPort: 123,
                  },
                ],
              },
            },
          },
        }),
      };
      const workspaceIngressRules = [
        {
          IpProtocol: 'tcp',
          FromPort: 123,
          ToPort: 123,
          IpRanges: [{ CidrIp: '123.123.123.123/32' }],
        },
        {
          IpProtocol: 'tcp',
          FromPort: 1,
          ToPort: 1,
          IpRanges: [{ CidrIp: '123.123.123.123/32' }],
        },
      ];
      service.getCfnDetails = jest.fn(() => {
        return { stackResources, templateDetails };
      });
      service.getWorkspaceSecurityGroup = jest.fn(() => {
        return { securityGroupResponse: { SecurityGroups: [{ IpPermissions: workspaceIngressRules }] } };
      });
      const expectedOutcome = [
        {
          protocol: 'tcp',
          fromPort: 123,
          toPort: 123,
          cidrBlocks: ['123.123.123.123/32'],
        },
      ];

      // OPERATE
      const { currentIngressRules, securityGroupId } = await service.getSecurityGroupDetails(
        requestContext,
        environment,
      );

      // CHECK
      expect(currentIngressRules).toMatchObject(expectedOutcome);
      expect(securityGroupId).toEqual(origSecurityGroupId);
    });
  });

  it('should send filtered security group rules as expected for EMR', async () => {
    // BUILD
    const requestContext = {};
    const stackArn = 'sampleCloudFormationStackArn';
    const environment = {
      outputs: [{ OutputKey: 'CloudformationStackARN', OutputValue: `<AwsAccountRoot>/${stackArn}` }],
      status: 'COMPLETED',
    };
    const origSecurityGroupId = 'sampleSecurityGroupId';
    // EMR's security group logical ID is different than the rest of the workspace-types
    const stackResources = {
      StackResourceSummaries: [{ LogicalResourceId: 'MasterSecurityGroup', PhysicalResourceId: origSecurityGroupId }],
    };
    const templateDetails = {
      TemplateBody: YAML.dump({
        Resources: {
          SecurityGroup: {
            Properties: {
              SecurityGroupIngress: [
                {
                  IpProtocol: 'tcp',
                  FromPort: 123,
                  ToPort: 123,
                },
              ],
            },
          },
        },
      }),
    };
    const workspaceIngressRules = [
      {
        IpProtocol: 'tcp',
        FromPort: 123,
        ToPort: 123,
        IpRanges: [{ CidrIp: '123.123.123.123/32' }],
      },
      {
        IpProtocol: 'tcp',
        FromPort: 1,
        ToPort: 1,
        IpRanges: [{ CidrIp: '123.123.123.123/32' }],
      },
    ];
    service.getCfnDetails = jest.fn(() => {
      return { stackResources, templateDetails };
    });
    service.getWorkspaceSecurityGroup = jest.fn(() => {
      return { securityGroupResponse: { SecurityGroups: [{ IpPermissions: workspaceIngressRules }] } };
    });
    const expectedOutcome = [
      {
        protocol: 'tcp',
        fromPort: 123,
        toPort: 123,
        cidrBlocks: ['123.123.123.123/32'],
      },
    ];

    // OPERATE
    const { currentIngressRules, securityGroupId } = await service.getSecurityGroupDetails(requestContext, environment);

    // CHECK
    expect(currentIngressRules).toMatchObject(expectedOutcome);
    expect(securityGroupId).toEqual(origSecurityGroupId);
  });

  it('should send empty array for ingress rules if no security group was found', async () => {
    // BUILD
    const requestContext = {};
    const stackArn = 'sampleCloudFormationStackArn';
    const environment = {
      outputs: [{ OutputKey: 'CloudformationStackARN', OutputValue: `<AwsAccountRoot>/${stackArn}` }],
      status: 'COMPLETED',
    };
    const stackResources = {
      StackResourceSummaries: [],
    };
    const templateDetails = {
      TemplateBody: YAML.dump({
        Resources: {}, // Resources does not contain SecurityGroup or MasterSecurityGroup
      }),
    };
    const workspaceIngressRules = [
      {
        IpProtocol: 'tcp',
        FromPort: 123,
        ToPort: 123,
        IpRanges: [{ CidrIp: '123.123.123.123/32' }],
      },
      {
        IpProtocol: 'tcp',
        FromPort: 1,
        ToPort: 1,
        IpRanges: [{ CidrIp: '123.123.123.123/32' }],
      },
    ];
    service.getCfnDetails = jest.fn(() => {
      return { stackResources, templateDetails };
    });
    service.getWorkspaceSecurityGroup = jest.fn(() => {
      return { securityGroupResponse: { SecurityGroups: [{ IpPermissions: workspaceIngressRules }] } };
    });
    const expectedOutcome = [];

    // OPERATE
    const { currentIngressRules, securityGroupId } = await service.getSecurityGroupDetails(requestContext, environment);

    // CHECK
    expect(currentIngressRules).toMatchObject(expectedOutcome);
    expect(securityGroupId).toBeUndefined();
  });
});
