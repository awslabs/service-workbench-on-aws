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

jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');

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
  let s3Service = null;
  let settings = null;

  const mockAccount = {
    id: 'testid',
    rev: 5,
    roleArn: 'TestRole',
    externalId: 'test-externalid',
    clientName: 'CloudFormation',
    onboardStatusRoleArn: 'otherRole',
    cfnStackName: 'HAPPY_STACK',
    permissionStatus: 'NEEDS_UPDATE',
  };

  const expectedUpdate = {
    id: mockAccount.id,
    rev: mockAccount.rev,
    roleArn: mockAccount.roleArn,
    externalId: mockAccount.externalId,
  };

  const mockYmlResponse = 'Attribute:\n\t- Value #This is a comment';

  const mockStackOutputs = [
    {
      OutputKey: 'EncryptionKeyArn',
      OutputValue: 'arn:aws:kms:placeholder',
      Description: 'KMS Encryption Key Arn',
    },
    {
      OutputKey: 'VPC',
      OutputValue: 'vpc-placeholder',
      Description: 'VPC ID',
    },
    {
      OutputKey: 'CrossAccountExecutionRoleArn',
      OutputValue: 'arn:aws:iam::execution-placeholder',
      Description: 'The arn of the cross account role.',
    },
    {
      OutputKey: 'VpcPublicSubnet1',
      OutputValue: 'subnet-placeholder',
      Description: 'A reference to the public subnet in the 1st Availability Zone',
    },
    {
      OutputKey: 'PublicRouteTableId',
      OutputValue: 'rtd-samplePublicRouteTableId',
      Description: 'The public route table assigned to the workspace VPC',
    },
    {
      OutputKey: 'CrossAccountEnvMgmtRoleArn',
      OutputValue: 'arn:aws:iam::placeholder',
      Description: 'The arn of the cross account role for environment management using AWS Service Catalog',
    },
    {
      OutputKey: 'PrivateWorkspaceSubnet',
      OutputValue: 'subnet-private',
      Description: 'Private Workspace Subnet',
    },
    {
      OutputKey: 'AppStreamStackName',
      OutputValue: 'appstream-stack',
      Description: 'AppStream Stack Name',
    },
    {
      OutputKey: 'AppStreamFleet',
      OutputValue: 'appstream-fleet',
      Description: 'AppStream Fleet',
    },
    {
      OutputKey: 'AppStreamSecurityGroup',
      OutputValue: 'sg-appstream',
      Description: 'Security Group AppStream',
    },
    {
      OutputKey: 'Route53HostedZone',
      OutputValue: 'HOSTEDZONE123',
      Description: 'Route53 HostedZone',
    },
  ];

  const mockCfnApi = {
    describeStacks: () => {
      return {
        promise: async () => {
          return {
            Stacks: [
              {
                StackName: 'HAPPY_STACK',
                StackId: 'HAPPY_ID',
                StackStatus: 'CREATE_COMPLETE',
                Outputs: mockStackOutputs,
              },
              { StackName: 'PENDING_STACK', StackStatus: 'UPDATE_IN_PROGRESS' },
              { StackName: 'ERRORED_STACK', StackStatus: 'UPDATE_FAILED' },
            ],
          };
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

  const mockS3Api = {
    putObject: () => {
      return {
        promise: async () => jest.fn(),
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
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('awsCfnService', new AwsCfnService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('awsCfnService');
    awsAccountsService = await container.find('awsAccountsService');
    awsService = await container.find('aws');
    cfnTemplateService = await container.find('cfnTemplateService');
    s3Service = await container.find('s3Service');
    settings = await container.find('settings');

    awsService.getCredentialsForRole.mockImplementation(jest.fn());
    awsAccountsService.list.mockImplementation(() => [mockAccount]);
    awsAccountsService.mustFind.mockImplementation(() => mockAccount);
    s3Service.api = mockS3Api;
    s3Service.sign.mockImplementation(async () => {
      return ['placeholder.url'];
    });

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

  describe('getAndUploadTemplateForAccount', () => {
    const requestContext = {};

    it('should fail due to insufficient permissions', async () => {
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // OPERATE
      try {
        await service.getAndUploadTemplateForAccount(requestContext, mockAccount.id);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('User is not authorized');
      }
    });

    it('should create a cfn template info object', async () => {
      awsAccountsService.mustFind.mockImplementation(() => mockAccount);
      settings.optional = jest.fn((key, defaultVal) => {
        if (key === 'domainName') {
          return defaultVal;
        }
        throw Error(`${key} not found`);
      });
      const res = await service.getAndUploadTemplateForAccount(requestContext, mockAccount.id);
      const expCfnInfo = {
        accountId: mockAccount.accountId,
        name: mockAccount.cfnStackName,
        cfnConsoleUrl: 'https://console.aws.amazon.com/cloudformation/home?region=undefined',
        template: mockYmlResponse,
      };
      expect(res).toMatchObject(expCfnInfo);
      expect(res.createStackUrl).toBeDefined();
      expect(res.createStackUrl).toBe(
        'https://console.aws.amazon.com/cloudformation/home?region=undefined#/stacks/create/review/?' +
          'templateURL=undefined&stackName=HAPPY_STACK&param_Namespace=HAPPY_STACK&' +
          'param_CentralAccountId=undefined&param_ExternalId=test-externalid&param_ApiHandlerArn=undefined&' +
          'param_WorkflowRoleArn=undefined&param_AppStreamFleetType=ON_DEMAND&' +
          'param_AppStreamDisconnectTimeoutSeconds=60&param_AppStreamFleetDesiredInstances=2&' +
          'param_AppStreamIdleDisconnectTimeoutSeconds=600&param_AppStreamImageName=&' +
          'param_AppStreamInstanceType=&param_AppStreamMaxUserDurationSeconds=86400&' +
          'param_EnableAppStream=false&param_DomainName=',
      );
    });

    it('cfn template with domain', async () => {
      awsAccountsService.mustFind.mockImplementation(() => mockAccount);
      settings.optional = jest.fn((key, _) => {
        if (key === 'domainName') {
          return 'testdomain.aws';
        }
        throw Error(`${key} not found`);
      });
      const res = await service.getAndUploadTemplateForAccount(requestContext, mockAccount.id);
      const expCfnInfo = {
        accountId: mockAccount.accountId,
        name: mockAccount.cfnStackName,
        cfnConsoleUrl: 'https://console.aws.amazon.com/cloudformation/home?region=undefined',
        template: mockYmlResponse,
      };
      const update = {
        cfnStackName: 'HAPPY_STACK',
        externalId: 'test-externalid',
        id: 'testid',
        onboardStatusRoleArn: 'arn:aws:iam:::role/HAPPY_STACK-cfn-status-role',
        permissionStatus: 'PENDING',
        rev: 5,
      };
      expect(res).toMatchObject(expCfnInfo);
      expect(res.createStackUrl).toBeDefined();
      expect(res.createStackUrl).toBe(
        'https://console.aws.amazon.com/cloudformation/home?region=undefined#/stacks/create/review/?' +
          'templateURL=undefined&stackName=HAPPY_STACK&param_Namespace=HAPPY_STACK&' +
          'param_CentralAccountId=undefined&param_ExternalId=test-externalid&param_ApiHandlerArn=undefined&' +
          'param_WorkflowRoleArn=undefined&param_AppStreamFleetType=ON_DEMAND&' +
          'param_AppStreamDisconnectTimeoutSeconds=60&param_AppStreamFleetDesiredInstances=2&' +
          'param_AppStreamIdleDisconnectTimeoutSeconds=600&param_AppStreamImageName=&' +
          'param_AppStreamInstanceType=&param_AppStreamMaxUserDurationSeconds=86400&' +
          'param_EnableAppStream=false&param_DomainName=testdomain.aws',
      );
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, update);
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

    it('should try to update the account from NEEDS_UPDATE to CURRENT', async () => {
      const expResult = { ...expectedUpdate, permissionStatus: 'CURRENT' };
      await service.batchCheckAndUpdateAccountPermissions(requestContext);
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expResult);
    });

    it('should correctly determine that the permissions are out of date', async () => {
      const mockNewYmlResponse = 'Attribute:\n\t- UpdatedValue #This is a comment';
      cfnTemplateService.getTemplate.mockImplementationOnce(async () => mockNewYmlResponse);
      const res = await service.checkAccountPermissions(requestContext, mockAccount.id);
      expect(res).toEqual('NEEDS_UPDATE');
    });

    it('should correctly ignore comments and whitespace for checking permissions', async () => {
      const mockNewYmlResponse = '\nAttribute:\n\t- Value #This is a newer comment';
      cfnTemplateService.getTemplate.mockImplementationOnce(async () => mockNewYmlResponse);

      const res = await service.checkAccountPermissions(requestContext, mockAccount.id);
      expect(res).toEqual('CURRENT');
    });

    it('should correctly set account with missing cfnStackName to UNKNOWN', async () => {
      // This account's status should change to 'ERRORED'
      // We shouldn't ever be in a position where the stack name is missing
      const noStackNameMock = {
        ...mockAccount,
        id: 'noStackName',
        accountId: 'noStackName',
        cfnStackName: '',
        permissionStatus: 'CURRENT',
      };
      const expUpdate = { ...expectedUpdate, id: noStackNameMock.id, permissionStatus: 'UNKNOWN' };

      awsAccountsService.list.mockImplementationOnce(() => [noStackNameMock]);
      awsAccountsService.mustFind.mockImplementationOnce(() => {
        return noStackNameMock;
      });

      const res = await service.batchCheckAndUpdateAccountPermissions(requestContext);
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expUpdate);

      expect(res.finalStatus[noStackNameMock.id]).toEqual(`UNKNOWN`);
    });

    it('should return PENDING for pending stacks', async () => {
      // This account's status should change to 'ERRORED'
      // We shouldn't ever be in a position where the stack name is missing
      const pendingStackNameMock = {
        ...mockAccount,
        id: 'noStackName',
        accountId: 'noStackName',
        cfnStackName: 'PENDING_STACK',
        permissionStatus: 'CURRENT',
      };
      const expUpdate = { ...expectedUpdate, id: pendingStackNameMock.id, permissionStatus: 'PENDING' };

      awsAccountsService.list.mockImplementationOnce(() => [pendingStackNameMock]);
      awsAccountsService.mustFind.mockImplementationOnce(() => {
        return pendingStackNameMock;
      });

      await service.batchCheckAndUpdateAccountPermissions(requestContext);
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expUpdate);
    });

    it('should return ERRORED for errored stacks', async () => {
      // This account's status should change to 'ERRORED'
      // We shouldn't ever be in a position where the stack name is missing
      const erroredStackNameMock = {
        ...mockAccount,
        id: 'noStackName',
        accountId: 'noStackName',
        cfnStackName: 'ERRORED_STACK',
        permissionStatus: 'CURRENT',
      };
      const expUpdate = { ...expectedUpdate, id: erroredStackNameMock.id, permissionStatus: 'ERRORED' };

      awsAccountsService.list.mockImplementationOnce(() => [erroredStackNameMock]);
      awsAccountsService.mustFind.mockImplementationOnce(() => {
        return erroredStackNameMock;
      });

      await service.batchCheckAndUpdateAccountPermissions(requestContext);
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expUpdate);
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

  describe('onboarding accounts', () => {
    const requestContext = {};
    it('should handle no accounts pending correctly', async () => {
      const res = await service.onboardPendingAccounts(requestContext);
      expect(res.auditLog).toEqual({});
      expect(res.newStatus).toEqual({});
    });

    it('should correctly handle pending accounts that have pending stacks', async () => {
      const pendingAccountMock = {
        ...mockAccount,
        id: 'pendingPendingAccount',
        accountId: 'pendingPendingAccount',
        cfnStackName: 'PENDING_STACK',
        permissionStatus: 'PENDING',
      };

      awsAccountsService.list.mockImplementationOnce(() => [pendingAccountMock]);
      awsAccountsService.mustFind.mockImplementationOnce(() => {
        return pendingAccountMock;
      });

      const res = await service.onboardPendingAccounts(requestContext);
      expect(res.auditLog[pendingAccountMock.id]).toContain('Account is not ready yet.');
      expect(res.newStatus[pendingAccountMock.id]).toEqual('PENDING');
    });

    it('should correctly handle pending accounts that have completed stacks', async () => {
      // This account's status should change to 'CURRENT'
      const completedAccountMock = {
        ...mockAccount,
        id: 'pendingCompletedAccount',
        accountId: 'pendingCompletedAccount',
        cfnStackName: 'HAPPY_STACK',
        permissionStatus: 'PENDING',
      };

      const expUpdate = {
        id: completedAccountMock.id,
        cfnStackId: 'HAPPY_ID',
        vpcId: 'vpc-placeholder',
        subnetId: 'subnet-placeholder',
        roleArn: 'arn:aws:iam::execution-placeholder',
        xAccEnvMgmtRoleArn: 'arn:aws:iam::placeholder',
        externalId: 'test-externalid',
        encryptionKeyArn: 'arn:aws:kms:placeholder',
        permissionStatus: 'CURRENT',
        rev: completedAccountMock.rev,
        publicRouteTableId: 'rtd-samplePublicRouteTableId',
      };

      awsAccountsService.list.mockImplementationOnce(() => [completedAccountMock]);
      awsAccountsService.mustFind.mockImplementationOnce(() => {
        return completedAccountMock;
      });

      const res = await service.onboardPendingAccounts(requestContext);
      expect(res.auditLog[completedAccountMock.id]).toEqual('Successfully Onboarded');
      expect(res.newStatus[completedAccountMock.id]).toEqual('CURRENT');
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expUpdate);
    });

    it('should correctly handle pending accounts that have completed with AppStream', async () => {
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return true;
        }
        throw Error(`${key} not found`);
      });
      settings.optional = jest.fn((key, _) => {
        if (key === 'domainName') {
          return 'testdomain.aws';
        }
        throw Error(`${key} not found`);
      });

      // This account's status should change to 'CURRENT'
      const completedAccountMock = {
        ...mockAccount,
        id: 'pendingCompletedAccount',
        accountId: 'pendingCompletedAccount',
        cfnStackName: 'HAPPY_STACK',
        permissionStatus: 'PENDING',
      };

      const expUpdate = {
        id: completedAccountMock.id,
        cfnStackId: 'HAPPY_ID',
        vpcId: 'vpc-placeholder',
        roleArn: 'arn:aws:iam::execution-placeholder',
        xAccEnvMgmtRoleArn: 'arn:aws:iam::placeholder',
        externalId: 'test-externalid',
        encryptionKeyArn: 'arn:aws:kms:placeholder',
        permissionStatus: 'CURRENT',
        rev: completedAccountMock.rev,
        appStreamFleetName: 'appstream-fleet',
        appStreamSecurityGroupId: 'sg-appstream',
        appStreamStackName: 'appstream-stack',
        route53HostedZone: 'HOSTEDZONE123',
        subnetId: 'subnet-private',
      };

      awsAccountsService.list.mockImplementationOnce(() => [completedAccountMock]);
      awsAccountsService.mustFind.mockImplementationOnce(() => {
        return completedAccountMock;
      });

      const res = await service.onboardPendingAccounts(requestContext);
      expect(res.auditLog[completedAccountMock.id]).toEqual('Successfully Onboarded');
      expect(res.newStatus[completedAccountMock.id]).toEqual('CURRENT');
      expect(awsAccountsService.update).toHaveBeenCalledWith(requestContext, expUpdate);
    });
  });
});
