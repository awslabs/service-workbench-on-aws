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
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('../../environment/environment-authz-service.js');
const EnvironmentAuthZServiceMock = require('../../environment/environment-authz-service.js');

jest.mock('../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');
const WorkflowTriggerServiceMock = require('../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');

jest.mock('../../project/project-service');
const ProjectServiceMock = require('../../project/project-service');

jest.mock('../../aws-accounts/aws-accounts-service');
const AwsAccountsServiceMock = require('../../aws-accounts/aws-accounts-service');

jest.mock('../../indexes/indexes-service');
const IndexesServiceMock = require('../../indexes/indexes-service');

const EnvironmentSCService = require('../environment-sc-service');

const workflowIds = {
  create: 'wf-provision-environment-sc',
  delete: 'wf-terminate-environment-sc',
};

describe('EnvironmentSCService', () => {
  let service = null;
  let dbService = null;
  let projectService = null;
  let wfService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('log', new Logger());
    container.register('aws', new AwsServiceMock());
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
    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('environmentSCService');
    dbService = await container.find('dbService');
    projectService = await container.find('projectService');
    wfService = await container.find('workflowTriggerService');

    // Skip authorization by default
    service.assertAuthorized = jest.fn();

    // Other function mocks
    projectService.mustFind = jest.fn(() => {
      return { indexId: 'exampleIndexId' };
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
});
