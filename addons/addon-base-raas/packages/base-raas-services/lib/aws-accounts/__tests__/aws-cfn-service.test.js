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

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/s3-service');
const S3ServiceMock = require('@aws-ee/base-services/lib/s3-service');

jest.mock('@aws-ee/base-services/lib/logger/logger-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('../aws-accounts-service');
const AwsAccountsServiceMock = require('../aws-accounts-service');

jest.mock('../../cfn-templates/cfn-template-service');
const CfnTemplateMock = require('../../cfn-templates/cfn-template-service');
const AwsCfnService = require('../aws-cfn-service');

describe('AwsAccountService', () => {
  let service = null;
  let awsService = null;
  let awsAccountsService = null;
  let cfnTemplateService = null;

  const mockAccount = {
    id: 'testid',
    rev: 5,
    roleArn: 'TestRole',
    externalId: 'workbench',
    clientName: 'CloudFormation',
    xAccEnvMgmtRoleArn: 'otherRole',
    cfnStackName: 'teststackname',
    permissionStatus: 'NEEDSUPDATE',
  };

  const expectedUpdate = {
    id: mockAccount.id,
    rev: mockAccount.rev,
    roleArn: mockAccount.roleArn,
    externalId: mockAccount.externalId,
  };

  const mockYmlResponse = 'Attribute:\n\t- Value #This is a comment';

  const mockCfnApi = {
    describeStacks: () => {
      return {
        promise: async () => {
          return { Stacks: [{ StackName: mockAccount.cfnStackName }] };
        },
      };
    },
    getTemplate: () => {
      return {
        promise: async () => {
          return { TemplateBody: mockYmlResponse };
        },
      };
    },
  };

  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('s3Service', new S3ServiceMock());
    container.register('cfnTemplateService', new CfnTemplateMock());
    container.register('aws', new AwsService());
    container.register('log', new Logger());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('awsCfnService', new AwsCfnService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('awsCfnService');
    awsAccountsService = await container.find('awsAccountsService');
    awsService = await container.find('aws');
    cfnTemplateService = await container.find('cfnTemplateService');

    awsService.getCredentialsForRole.mockImplementation(jest.fn());
    awsAccountsService.list.mockImplementation(() => [mockAccount]);
    awsAccountsService.mustFind.mockImplementation(() => mockAccount);

    // Skip authorization by default
    service.assertAuthorized = jest.fn();
    awsService.getClientSdkForRole.mockImplementation(() => mockCfnApi);
    cfnTemplateService.getTemplate.mockImplementation(() => mockYmlResponse);
  });

  describe('getCfnSdk', () => {
    it('should fail due to an unassumable role', async () => {
      awsService.getClientSdkForRole.mockImplementationOnce(async () => {
        throw Error('error!');
      });
      try {
        await service.getCfnSdk(mockAccount.xAccEnvMgmtRoleArn, mockAccount.cfnStackName, 'us-east-1');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Could not assume a role to check the stack status');
      }
    });
  });

  describe('checkAccountPermissions', () => {
    const requestContext = {};

    it('should fail due to insufficient permissions', async () => {
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // OPERATE
      try {
        await service.checkAccountPermissions(requestContext, mockAccount.id);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('User is not authorized');
      }
    });

    it('should try to update the account from NEEDSUPDATE to CURRENT', async () => {
      const expResult = { ...expectedUpdate, permissionStatus: 'CURRENT' };
      await service.batchCheckAccountPermissions(requestContext);
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expResult);
    });

    it('should correctly determine that the permissions are out of date', async () => {
      const mockNewYmlResponse = 'Attribute:\n\t- UpdatedValue #This is a comment';
      cfnTemplateService.getTemplate.mockImplementationOnce(async () => mockNewYmlResponse);
      const res = await service.checkAccountPermissions(requestContext, mockAccount.id);
      expect(res).toEqual('NEEDSUPDATE');
    });

    it('should correctly ignore comments and whitespace for checking permissions', async () => {
      const mockNewYmlResponse = '\nAttribute:\n\t- Value #This is a newer comment';
      cfnTemplateService.getTemplate.mockImplementationOnce(async () => mockNewYmlResponse);

      const res = await service.checkAccountPermissions(requestContext, mockAccount.id);
      expect(res).toEqual('CURRENT');
    });

    it('should correctly set account with undefined cfnStackName to NEEDSONBOARD or NOSTACKNAME', async () => {
      // This account should remain the same
      const needsOnboardMock = {
        ...mockAccount,
        id: 'needsOnboard',
        accountId: 'needsOnboard',
        cfnStackName: '',
        permissionStatus: 'NEEDSONBOARD',
      };
      // This account's status should change to 'NOSTACKNAME'
      const noStackNameMock = {
        ...mockAccount,
        id: 'noStackName',
        accountId: 'noStackName',
        cfnStackName: '',
        permissionStatus: 'ERRORED',
      };
      const expUpdate = { ...expectedUpdate, id: noStackNameMock.id, permissionStatus: 'NOSTACKNAME' };
      const expBadUpdate = { ...expectedUpdate, id: needsOnboardMock.id, permissionStatus: 'NEEDSONBOARD' };

      awsAccountsService.list.mockImplementationOnce(() => [noStackNameMock, needsOnboardMock]);
      awsAccountsService.mustFind.mockImplementation(id => {
        return id === needsOnboardMock.id ? needsOnboardMock : noStackNameMock;
      });

      const res = await service.batchCheckAccountPermissions(requestContext);
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expUpdate);
      expect(awsAccountsService.update).not.toHaveBeenCalledWith(requestContext, expBadUpdate);

      expect(res.errors[needsOnboardMock.id]).toEqual(
        `Error: Account ${needsOnboardMock.accountId} has no CFN stack name specified.`,
      );
      expect(res.errors[noStackNameMock.id]).toEqual(
        `Error: Account ${noStackNameMock.accountId} has no CFN stack name specified.`,
      );
    });
  });

  describe('getStackTemplate', () => {
    const requestContext = {};

    it('should fail due to insufficient permissions', async () => {
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // OPERATE
      try {
        await service.getStackTemplate(requestContext, mockAccount.id);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('User is not authorized');
      }
    });
  });
});
