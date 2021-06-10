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
const AwsMock = require('aws-sdk-mock');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');

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

jest.mock('../aws-accounts-service');
const AwsAccountsServiceMock = require('../aws-accounts-service');

jest.mock('../../cfn-templates/cfn-template-service');
const CfnTemplateMock = require('../../cfn-templates/cfn-template-service');
const AwsCfnService = require('../aws-cfn-service');

describe('AwsAccountService', () => {
  let service = null;
  let awsService = null;
  let awsAccountsService = null;

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

  const mockCredentials = {
    accessKeyId: 'accessKeyId',
    secretAccessKey: 'secretAccessKey',
    sessionToken: 'sessionToken',
    accountId: 'accountId',
  };

  const mockYmlResponse = 'Attribute:\n\t- Value #This is a comment';

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
    AwsMock.setSDKInstance(awsService.sdk);

    // awsService.getCredentialsForRole.mockImplementation(jest.fn());

    awsService.getCredentialsForRole = jest.fn();

    // Skip authorization by default
    service.assertAuthorized = jest.fn();
    // service._getCredentials = jest.fn(() => mockCredentials);
  });

  afterEach(() => {
    AwsMock.restore();
  });

  //   describe('something', () => {
  //     it('will do stuff', () => {
  //       expect(undefined).toBeUndefined();
  //     });
  //   });

  //   describe('getCfnSdk', () => {
  //     it('should fail due to an unassumable role', async () => {
  //       try {
  //         await service.getCfnSdk(mockAccount.xAccEnvMgmtRoleArn, mockAccount.cfnStackName, 'us-east-1');
  //         expect.hasAssertions();
  //       } catch (err) {
  //         // CHECK
  //         expect(err.message).toEqual('Could not assume a role to check the stack status');
  //       }
  //     });
  //   });

  describe('checkAccountPermissions', () => {
    const requestContext = {};
    AwsMock.mock('CloudFormation', 'getTemplate', mockAccount);

    it('will do other stuff', () => {
      expect(undefined).toBeUndefined();
    });

    //   it('should fail due to insufficient permissions', async () => {
    //     service.assertAuthorized.mockImplementationOnce(() => {
    //       throw new Error('User is not authorized');
    //     });

    //     // OPERATE
    //     try {
    //       await service.checkAccountPermissions(requestContext, mockAccount.id);
    //       expect.hasAssertions();
    //     } catch (err) {
    //       // CHECK
    //       expect(err.message).toEqual('User is not authorized');
    //     }
    //   });

    // it('should try to update the account from NEEDSUPDATE to CURRENT', async () => {
    //   const expResult = { ...expectedUpdate, permissionStatus: 'CURRENT' };
    //   await service.batchCheckAccountPermissions(requestContext, [mockAccount]);
    //   expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expResult);
    // });
  });

  //   describe('getStackTemplate', () => {
  //     const requestContext = {};

  //     it('should fail due to insufficient permissions', async () => {
  //       service.assertAuthorized.mockImplementationOnce(() => {
  //         throw new Error('User is not authorized');
  //       });

  //       // OPERATE
  //       try {
  //         await service.getStackTemplate(requestContext, mockAccount.id);
  //         expect.hasAssertions();
  //       } catch (err) {
  //         // CHECK
  //         expect(err.message).toEqual('User is not authorized');
  //       }
  //     });
  //   });
});
