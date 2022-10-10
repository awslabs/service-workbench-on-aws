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

const ServicesContainer = require('@amzn/base-services-container/lib/services-container');

jest.mock('@amzn/base-services/lib/iam/iam-service');
jest.mock('@amzn/base-services/lib/logger/logger-service');
const AwsService = require('@amzn/base-services/lib/aws/aws-service');

// Mocked dependencies
jest.mock('@amzn/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@amzn/base-services/lib/authorization/authorization-service');

jest.mock('@amzn/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');

jest.mock('@amzn/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@amzn/base-services/lib/audit/audit-writer-service');

jest.mock('@amzn/environment-type-mgmt-services/lib/environment-type/env-type-config-service');
const EnvTypeConfigServiceMock = require('@amzn/environment-type-mgmt-services/lib/environment-type/env-type-config-service');

jest.mock('@amzn/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryService = require('@amzn/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('../../environment-authz-service');
const EnvironmentAuthZServiceMock = require('../../environment-authz-service');

jest.mock('../../../aws-accounts/aws-accounts-service');
const AwsAccountsServiceMock = require('../../../aws-accounts/aws-accounts-service');

jest.mock('../../../user/user-service');
const UserServiceMock = require('../../../user/user-service');

jest.mock('../../environment-ami-service');
const EnvironmentAmiServiceMock = require('../../environment-ami-service');

jest.mock('../../../indexes/indexes-service');
const IndexesServiceMock = require('../../../indexes/indexes-service');

jest.mock('../../../study/study-service');
const StudyServiceMock = require('../../../study/study-service');

jest.mock('../environment-sc-service');
const EnvironmentSCServiceMock = require('../environment-sc-service');

jest.mock('../environment-sc-keypair-service');
const EnvironmentSCKeyPairServiceMock = require('../environment-sc-keypair-service');

jest.mock('../../../data-egress/data-egress-service');
const DataEgressService = require('../../../data-egress/data-egress-service');

const EnvironmentConfigVarsService = require('../environment-config-vars-service');

const createAdminContext = ({ uid = 'uid-admin' } = {}) => ({
  principalIdentifier: { uid },
  principal: { isAdmin: true, userRole: 'admin', status: 'active' },
});

describe('EnvironmentSCService', () => {
  let service = null;
  let environmentScService = null;
  let indexesService = null;
  let awsAccountsService = null;
  let envTypeConfigService = null;
  let environmentAmiService = null;
  let userService = null;
  let settingsService = null;
  let dataEgressService = null;

  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('userService', new UserServiceMock());
    container.register('aws', new AwsService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('envTypeConfigService', new EnvTypeConfigServiceMock());
    container.register('environmentAmiService', new EnvironmentAmiServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('environmentConfigVarsService', new EnvironmentConfigVarsService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('environmentAuthzService', new EnvironmentAuthZServiceMock());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('indexesService', new IndexesServiceMock());
    container.register('environmentScService', new EnvironmentSCServiceMock());
    container.register('environmentScKeypairService', new EnvironmentSCKeyPairServiceMock());
    container.register('studyService', new StudyServiceMock());
    container.register('dataEgressService', new DataEgressService());
    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('environmentConfigVarsService');
    dataEgressService = await container.find('dataEgressService');
    environmentScService = await container.find('environmentScService');
    indexesService = await container.find('indexesService');
    awsAccountsService = await container.find('awsAccountsService');
    envTypeConfigService = await container.find('envTypeConfigService');
    environmentAmiService = await container.find('environmentAmiService');
    userService = await container.find('userService');
    settingsService = await container.find('settings');
    awsAccountsService = await container.find('awsAccountsService');

    awsAccountsService.mustFind = jest.fn(() => {
      return Promise.resolve({
        cfnStackId:
          'arn:aws:cloudformation:eu-west-1:123456789012:stack/initial-stack-1625689755737/ff9a0dc0-df61-11eb-8b32-024312ba26d9',
      });
    });
    // Skip authorization by default
    service.assertAuthorized = jest.fn();
  });

  function mockSettingsService(settings) {
    settingsService.get = jest.fn(getKey => {
      let retValue;
      Object.keys(settings).forEach(key => {
        if (key === getKey) {
          retValue = settings[key];
        }
      });
      return retValue;
    });
    settingsService.getBoolean = jest.fn(getKey => {
      let retValue;
      Object.keys(settings).forEach(key => {
        if (key === getKey) {
          retValue = settings[key];
        }
      });
      return retValue;
    });
  }

  describe('resolveEnvConfigVars', () => {
    it('should fail if any index configuration is missing - AWS Service Catalog Role Arn', async () => {
      // BUILD
      const requestContext = 'sampleRequestContext';
      const envId = 'sampleEnvId';
      const envTypeId = 'sampleEnvTypeId';
      const envTypeConfigId = 'sampleEnvTypeConfigId';

      environmentScService.mustFind = jest.fn(() => {
        return {
          name: 'environment-1',
          description: 'env-desc',
          projectId: 'testProj',
          indexId: 'testIndex',
          cidr: '192.168.xx.yy',
          studyIds: ['study-1', 'study-2'],
        };
      });

      indexesService.mustFind = jest.fn(() => {
        return { awsAccountId: '123456789012' };
      });

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: undefined, // This shouldn't be undefined
          externalId: 'ExternalId-Test',
          accountId: '123456789012',
          vpcId: 'VpcId-Test',
          subnetId: 'SubnetId-Test',
          encryptionKeyArn: 'UltraSecureEncryptionKey',
        };
      });

      // EXECUTE & CHECK - 1
      await expect(service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId })).rejects.toThrow(
        `Index "testIndex" has not been correctly configured: missing AWS Service Catalog Role Arn.`,
      );

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: undefined, // This shouldn't be undefined
          externalId: 'ExternalId-Test',
          accountId: '123456789012',
          vpcId: 'VpcId-Test',
          subnetId: 'SubnetId-Test',
          encryptionKeyArn: 'UltraSecureEncryptionKey',
        };
      });

      // EXECUTE & CHECK - 2
      await expect(service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId })).rejects.toThrow(
        `Index "testIndex" has not been correctly configured: missing AWS Service Catalog Role Arn.`,
      );

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
          externalId: 'ExternalId-Test',
          accountId: undefined, // This shouldn't be undefined
          vpcId: 'VpcId-Test',
          subnetId: 'SubnetId-Test',
          encryptionKeyArn: 'UltraSecureEncryptionKey',
        };
      });

      // EXECUTE & CHECK - 3
      await expect(service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId })).rejects.toThrow(
        `Index "testIndex" has not been correctly configured: missing AWS account ID.`,
      );

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
          externalId: 'ExternalId-Test',
          accountId: '123456789012',
          vpcId: undefined, // This shouldn't be undefined
          subnetId: 'SubnetId-Test',
          encryptionKeyArn: 'UltraSecureEncryptionKey',
        };
      });

      // EXECUTE & CHECK - 4
      await expect(service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId })).rejects.toThrow(
        `Index "testIndex" has not been correctly configured: missing VPC ID.`,
      );

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
          externalId: 'ExternalId-Test',
          accountId: '123456789012',
          vpcId: 'VpcId-Test',
          subnetId: undefined, // This shouldn't be undefined
          encryptionKeyArn: 'UltraSecureEncryptionKey',
        };
      });

      // EXECUTE & CHECK - 5
      await expect(service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId })).rejects.toThrow(
        `Index "testIndex" has not been correctly configured: missing VPC Subnet ID.`,
      );

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
          externalId: 'ExternalId-Test',
          accountId: '123456789012',
          vpcId: 'VpcId-Test',
          subnetId: 'SubnetId-Test',
          encryptionKeyArn: undefined, // This shouldn't be undefined
        };
      });

      // EXECUTE & CHECK - 6
      await expect(service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId })).rejects.toThrow(
        `Index "testIndex" has not been correctly configured: missing Encryption Key ARN.`,
      );
    });

    it('should not fail for happy path scenario', async () => {
      // BUILD
      const requestContext = 'sampleRequestContext';
      const envId = 'sampleEnvId';
      const envTypeId = 'sampleEnvTypeId';
      const envTypeConfigId = 'sampleEnvTypeConfigId';

      environmentScService.mustFind = jest.fn(() => {
        return {
          name: 'environment-1',
          description: 'env-desc',
          projectId: 'testProj',
          indexId: 'testIndex',
          cidr: '192.168.xx.yy',
          studyIds: ['study-1', 'study-2'],
        };
      });

      indexesService.mustFind = jest.fn(() => {
        return { awsAccountId: '123456789012' };
      });

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
          externalId: 'ExternalId-Test',
          accountId: '123456789012',
          vpcId: 'VpcId-Test',
          subnetId: 'SubnetId-Test',
          encryptionKeyArn: 'UltraSecureEncryptionKey',
          cfnStackId:
            'arn:aws:cloudformation:eu-west-1:123456789012:stack/initial-stack-1625689755737/ff9a0dc0-df61-11eb-8b32-024312ba26d9',
        };
      });

      envTypeConfigService.mustFind = jest.fn(() => {
        return { params: [{ value: 'ami-1234567890' }, { value: 'ami-0987654321' }] };
      });

      environmentAmiService.ensurePermissions = jest.fn();

      userService.mustFindUser = jest.fn(() => {
        return { uid: 'dunderMifflin', username: 'Michael Scott', ns: 'test@example.com' };
      });

      mockSettingsService({
        environmentInstanceFiles: '{}',
        isAppStreamEnabled: 'true',
        solutionNamespace: 'initial-stack-1625689755737',
      });
      const expectedResponse = {
        accountId: '123456789012',
        adminKeyPairName: '',
        cidr: '192.168.xx.yy',
        description: 'env-desc',
        egressStoreIamPolicyDocument: '{}',
        encryptionKeyArn: 'UltraSecureEncryptionKey',
        envId: 'sampleEnvId',
        envTypeConfigId: 'sampleEnvTypeConfigId',
        envTypeId: 'sampleEnvTypeId',
        environmentInstanceFiles: '{}',
        externalId: 'ExternalId-Test',
        iamPolicyDocument: '{}',
        indexId: 'testIndex',
        name: 'environment-1',
        projectId: 'testProj',
        s3Mounts: '[]',
        studyIds: ['study-1', 'study-2'],
        subnetId: 'SubnetId-Test',
        uid: 'dunderMifflin',
        userNamespace: 'test@example.com',
        username: 'Michael Scott',
        vpcId: 'VpcId-Test',
        xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
        isAppStreamEnabled: 'true',
        solutionNamespace: 'initial-stack-1625689755737',
      };

      // EXECUTE & CHECK
      await expect(
        service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId }),
      ).resolves.toStrictEqual(expectedResponse);
    });

    it('should succeed for happy path scenario with data egress feature enabled', async () => {
      // BUILD
      mockSettingsService({
        environmentInstanceFiles: '{}',
        isAppStreamEnabled: 'true',
        solutionNamespace: 'initial-stack-1625689755737',
        enableEgressStore: true,
      });
      const requestContext = createAdminContext();
      const envId = 'sampleEnvId';
      const envTypeId = 'sampleEnvTypeId';
      const envTypeConfigId = 'sampleEnvTypeConfigId';

      environmentScService.mustFind = jest.fn(() => {
        return {
          name: 'environment-1',
          description: 'env-desc',
          projectId: 'testProj',
          indexId: 'testIndex',
          cidr: '192.168.xx.yy',
          studyIds: ['study-1', 'study-2'],
        };
      });

      indexesService.mustFind = jest.fn(() => {
        return { awsAccountId: '123456789012' };
      });

      awsAccountsService.mustFind = jest.fn(() => {
        return {
          xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
          externalId: 'ExternalId-Test',
          accountId: '123456789012',
          vpcId: 'VpcId-Test',
          subnetId: 'SubnetId-Test',
          encryptionKeyArn: 'UltraSecureEncryptionKey',
          cfnStackId:
            'arn:aws:cloudformation:eu-west-1:123456789012:stack/initial-stack-1625689755737/ff9a0dc0-df61-11eb-8b32-024312ba26d9',
        };
      });

      dataEgressService.getEgressStoreInfo = jest.fn(() => {
        return { createdBy: 'sampleUserUid', roleArn: 'sampleMainAcctRoleArn' };
      });

      envTypeConfigService.mustFind = jest.fn(() => {
        return { params: [{ value: 'ami-1234567890' }, { value: 'ami-0987654321' }] };
      });

      environmentAmiService.ensurePermissions = jest.fn();

      userService.mustFindUser = jest.fn(() => {
        return { uid: 'dunderMifflin', username: 'Michael Scott', ns: 'test@example.com' };
      });

      service.getEgressStoreMount = jest.fn(() => {
        return {};
      });

      const expectedResponse = {
        egressStoreIamPolicyDocument:
          '{"Version":"2012-10-17","Statement":[{"Sid":"studyAssumeRoles","Action":["sts:AssumeRole"],"Effect":"Allow","Resource":["sampleMainAcctRoleArn"]}]}',
        accountId: '123456789012',
        adminKeyPairName: '',
        cidr: '192.168.xx.yy',
        description: 'env-desc',
        encryptionKeyArn: 'UltraSecureEncryptionKey',
        envId: 'sampleEnvId',
        envTypeConfigId: 'sampleEnvTypeConfigId',
        envTypeId: 'sampleEnvTypeId',
        environmentInstanceFiles: '{}',
        externalId: 'ExternalId-Test',
        iamPolicyDocument: '{}',
        indexId: 'testIndex',
        name: 'environment-1',
        projectId: 'testProj',
        s3Mounts: '[{}]',
        studyIds: ['study-1', 'study-2'],
        subnetId: 'SubnetId-Test',
        uid: 'dunderMifflin',
        userNamespace: 'test@example.com',
        username: 'Michael Scott',
        vpcId: 'VpcId-Test',
        xAccEnvMgmtRoleArn: 'xAccEnvMgmtRole-Test',
        isAppStreamEnabled: 'true',
        solutionNamespace: 'initial-stack-1625689755737',
      };

      // EXECUTE & CHECK
      await expect(
        service.resolveEnvConfigVars(requestContext, { envId, envTypeId, envTypeConfigId }),
      ).resolves.toStrictEqual(expectedResponse);
    });
  });
});
