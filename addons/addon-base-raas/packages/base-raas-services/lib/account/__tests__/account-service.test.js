const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AWSMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');
const WorkflowTriggerServiceMock = require('../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');

const AccountService = require('../account-service');

// Tested Methods: provisionAccount, update, delete
describe('accountService', () => {
  let service = null;
  let dbService = null;
  let wfService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeAll(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('aws', new AWSMock());
    container.register('workflowTriggerService', new WorkflowTriggerServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('accountService', new AccountService());
    await container.initServices();

    service = await container.find('accountService');
    dbService = await container.find('dbService');
    wfService = await container.find('workflowTriggerService');
    service.assertAuthorized = jest.fn();
  });

  describe('provisionAccount tests', () => {
    it('should fail to create account with no credentials', async () => {
      // BUILD
      // OPERATE
      try {
        await service.provisionAccount({}, {});
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail to create account with partial credentials', async () => {
      // BUILD
      const dataMissing = {
        accountName: 'Winston Bishop',
        accountEmail: 'beanbagchair@example.com',
        masterRoleArn: '',
        externalId: '',
        description: '',
      };

      // OPERATE
      try {
        await service.provisionAccount({}, dataMissing);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(
          'Creating AWS account process has not been correctly configured: missing AWS account ID, VPC ID and VPC Subnet ID.',
        );
      }
    });

    it('should successfully try to provision an account with full credentials', async () => {
      // BUILD
      const iptData = {
        accountName: "Who's that girl?",
        accountEmail: 'itsjest@example.com',
        masterRoleArn: 'reagan :/',
        externalId: '837 Traction Ave',
        description: 'A classic nodejs-lodash mess-around',
      };
      service.audit = jest.fn();
      wfService.triggerWorkflow = jest.fn();

      // OPERATE
      await service.provisionAccount({}, iptData);

      // CHECK
      expect(wfService.triggerWorkflow).toHaveBeenCalledWith(
        {},
        {
          workflowId: 'wf-provision-account',
        },
        expect.objectContaining(iptData),
      );
      expect(service.audit).toHaveBeenCalledWith(
        {},
        {
          action: 'provision-account',
          body: {
            accountName: "Who's that girl?",
            accountEmail: 'itsjest@example.com',
            description: 'A classic nodejs-lodash mess-around',
          },
        },
      );
    });
  });

  describe('update tests', () => {
    it('should fail if no id is provided', async () => {
      // BUILD
      const acct = {
        stackId: 'example-stack-id',
      };
      // OPERATE
      try {
        await service.update({}, acct);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail because the account does not exist', async () => {
      // BUILD
      service.find = jest.fn().mockResolvedValue(undefined);
      try {
        // OPERATE
        await service.update({}, { id: 'Spencer' });
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'notFound')).toBe(true);
      }
    });

    it('should should fail to find the environment id', async () => {
      // BUILD
      const existingAcct = {
        id: 'testFAIL',
      };
      const iptData = {
        id: 'testFAIL',
      };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      service.mustFind = jest.fn().mockResolvedValue(existingAcct);

      try {
        await service.update({}, iptData);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('environment with id "testFAIL" does not exist');
      }
    });

    it('should successfully try to update the account', async () => {
      // BUILD
      const existingAcct = {
        id: 'schmidt',
      };
      const iptData = {
        id: 'bishop',
      };
      service.mustFind = jest.fn().mockResolvedValue(existingAcct);
      service.audit = jest.fn();

      // OPERATE
      await service.update({}, iptData);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        {},
        {
          action: 'update-account',
          body: iptData,
        },
      );
    });
  });

  describe('delete tests', () => {
    it('should fail because the id does not exist', async () => {
      // BUILD
      dbService.table.delete.mockImplementationOnce(() => {
        throw error;
      });

      // OPERATE
      try {
        await service.delete({}, { id: 'testFAIL' });
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'notFound')).toBe(true);
      }
    });

    it('should succeed to delete the account', async () => {
      // BUILD
      service.audit = jest.fn();

      // OPERATE
      await service.delete({}, { id: 'testSUCCEED' });

      // CHECK
      expect(dbService.table.delete).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, { action: 'delete-account', body: { id: 'testSUCCEED' } });
    });
  });
});
