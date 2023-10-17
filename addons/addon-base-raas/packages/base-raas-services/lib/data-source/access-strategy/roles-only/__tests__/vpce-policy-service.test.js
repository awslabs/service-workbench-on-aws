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

// TODO: Remove extra classes if found a better way
/* eslint-disable max-classes-per-file */

const ServicesContainer = require('@amzn/base-services-container/lib/services-container');

// Mocked services
jest.mock('@amzn/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@amzn/base-services/lib/audit/audit-writer-service');
jest.mock('../../../../study/study-service');
jest.mock('../../../../aws-accounts/aws-accounts-service');
jest.mock('../../../../project/project-service');
jest.mock('@amzn/base-services/lib/settings/env-settings-service');
jest.mock('@amzn/base-services/lib/aws/aws-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');

const AuthService = require('@amzn/base-services/lib/authorization/authorization-service');
const AuditService = require('@amzn/base-services/lib/audit/audit-writer-service');
const PluginRegistryService = require('@amzn/base-services/lib/plugin-registry/plugin-registry-service');
const AwsService = require('@amzn/base-services/lib/aws/aws-service');
const JsonSchemaValidationService = require('@amzn/base-services/lib/json-schema-validation-service');

const S3Service = require('@amzn/base-services/lib/s3-service');
const CfnTemplateMock = require('../../../../cfn-templates/cfn-template-service');
const StudyService = require('../../../../study/study-service');
const AwsCfnServiceMock = require('../../../../aws-accounts/aws-cfn-service');
const AwsAccountsServiceMock = require('../../../../aws-accounts/aws-accounts-service');
const ProjectServiceMock = require('../../../../project/project-service');
const VpcePolicyService = require('../vpce-policy-service');

const mockAssumeRole = jest.fn(() => {
  return Promise.resolve({
    Credentials: {
      AccessKeyId: 'EXAMPLEXXXXXXXXXXX',
      SecretAccessKey: 'EXAMPLEsecretAccessKey',
      SessionToken: 'EXAPLEsessionToken',
    },
  });
});

const mockModifyVpcEndpoint = jest.fn(() => {
  return Promise.resolve();
});

let mockDescribeVpcEndpoints = jest.fn(() => {
  return Promise.resolve({});
});

class MockSTS {
  constructor() {
    this.assumeRole = jest.fn(({ RoleArn, RoleSessionName, ExternalId }) => ({
      promise: () => mockAssumeRole({ RoleArn, RoleSessionName, ExternalId }),
    }));
  }
}

class MockEC2 {
  constructor() {
    this.modifyVpcEndpoint = jest.fn(({ VpcEndpointId, PolicyDocument }) => ({
      promise: () => mockModifyVpcEndpoint({ VpcEndpointId, PolicyDocument }),
    }));

    this.describeVpcEndpoints = jest.fn(() => ({
      promise: () => mockDescribeVpcEndpoints(),
    }));
  }
}

describe('VPCE Policy Service', () => {
  let service;
  let studyService;
  let projectService;
  let awsAccountsService;
  let aws;
  let awsCfnService;
  const requestContext = { principal: { username: 'sampleUsername' } };
  const studyEntity = { id: 'sampleBYOBstudyId' };
  const projectId = 'sampleProjectId';
  const awsAccountId = 'sampleAwsAccountId';
  const accountEntity = { awsAccountId };
  const roleArn = 'sampleRoleArn';
  const externalId = 'sampleExternalId';
  const vpceId = 'sampleVPCeId';
  const kmsSidToReplace = 'BYOB Account Keys';
  const region = 'us-east-1';
  const stsSidToReplace = 'AllowAssumeRole';

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('roles-only/vpcePolicyService', new VpcePolicyService());
    container.register('projectService', new ProjectServiceMock());
    container.register('awsAccountsService', new AwsAccountsServiceMock());
    container.register('studyService', new StudyService());
    container.register('aws', new AwsService());
    container.register('awsCfnService', new AwsCfnServiceMock());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('cfnTemplateService', new CfnTemplateMock());
    container.register('s3Service', new S3Service());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();

    service = await container.find('roles-only/vpcePolicyService');
    studyService = await container.find('studyService');
    projectService = await container.find('projectService');
    awsAccountsService = await container.find('awsAccountsService');
    aws = await container.find('aws');
    awsCfnService = await container.find('awsCfnService');

    aws.sdk = {
      STS: MockSTS,
      EC2: MockEC2,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEc2ServiceForStudy', () => {
    test('should return an ec2 service for the study', async () => {
      // BUILD
      studyService.mustFind = jest.fn().mockReturnValue(projectId);
      projectService.getAccountForProjectId = jest.fn().mockReturnValue(awsAccountId);
      awsAccountsService.mustFind = jest.fn().mockReturnValue({ roleArn, externalId });

      // OPERATE
      await service.getEc2ServiceForStudy(requestContext, studyEntity);

      // CHECK
      expect(mockAssumeRole).toHaveBeenCalledWith({
        RoleArn: roleArn,
        RoleSessionName: `RaaS-${requestContext.principal.username}`,
        ExternalId: externalId,
      });
    });

    test('should throw error if username is not defined', async () => {
      // BUILD
      studyService.mustFind = jest.fn().mockReturnValue(projectId);
      projectService.getAccountForProjectId = jest.fn().mockReturnValue(awsAccountId);
      awsAccountsService.mustFind = jest.fn().mockReturnValue({ roleArn, externalId });
      requestContext.principal.username = undefined;

      // OPERATE n CHECK
      await expect(service.getEc2ServiceForStudy(requestContext, studyEntity)).rejects.toThrow();
    });
  });

  describe('addAccountToKmsVpcePolicy', () => {
    test('should create new policy statement when one does not exist', async () => {
      // BUILD
      const policyDocumentWithoutSid = {
        Version: '2012-10-17',
        Statement: [],
      };
      service.getVpcePolicy = jest.fn().mockReturnValue(policyDocumentWithoutSid);
      const policyDocumentWithSid = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: kmsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
            Resource: [`arn:aws:kms:${region}:${awsAccountId}:key/*`],
          },
        ],
      };

      // OPERATE
      await service.addAccountToKmsVpcePolicy(new MockEC2(), awsAccountId, vpceId, region, kmsSidToReplace);

      // CHECK
      expect(mockModifyVpcEndpoint).toHaveBeenCalledWith({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(policyDocumentWithSid),
      });
    });

    test('should add new resource to existing policy statement', async () => {
      // BUILD
      const policyDocumentWithoutResource = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: kmsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
            Resource: [`arn:aws:kms:${region}:123456789123:key/*`],
          },
        ],
      };
      service.getVpcePolicy = jest.fn().mockReturnValue(policyDocumentWithoutResource);
      const policyDocumentWithResource = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: kmsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
            Resource: [`arn:aws:kms:${region}:123456789123:key/*`, `arn:aws:kms:${region}:${awsAccountId}:key/*`],
          },
        ],
      };

      // OPERATE
      await service.addAccountToKmsVpcePolicy(new MockEC2(), awsAccountId, vpceId, region, kmsSidToReplace);

      // CHECK
      expect(mockModifyVpcEndpoint).toHaveBeenCalledWith({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(policyDocumentWithResource),
      });
    });

    test('should not modify policy if statement exists and resource has already been added', async () => {
      // BUILD
      const policyDocumentWithResource = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: kmsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:GenerateDataKey', 'kms:ReEncrypt*'],
            Resource: [`arn:aws:kms:${region}:${awsAccountId}:key/*`],
          },
        ],
      };
      service.getVpcePolicy = jest.fn().mockReturnValue(policyDocumentWithResource);

      // OPERATE
      await service.addAccountToKmsVpcePolicy(new MockEC2(), awsAccountId, vpceId, region, kmsSidToReplace);

      // CHECK
      expect(mockModifyVpcEndpoint).not.toHaveBeenCalled();
    });
  });

  describe('addRoleToStsVpcePolicy', () => {
    test('should create new policy statement when one does not exist', async () => {
      // BUILD
      const policyDocumentWithoutSid = {
        Version: '2012-10-17',
        Statement: [],
      };
      service.getVpcePolicy = jest.fn().mockReturnValue(policyDocumentWithoutSid);
      const policyDocumentWithSid = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: stsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['sts:AssumeRole'],
            Resource: [roleArn],
          },
        ],
      };

      // OPERATE
      await service.addRoleToStsVpcePolicy(new MockEC2(), roleArn, vpceId, stsSidToReplace);

      // CHECK
      expect(mockModifyVpcEndpoint).toHaveBeenCalledWith({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(policyDocumentWithSid),
      });
    });

    test('should add new resource to existing policy statement', async () => {
      // BUILD
      const policyDocumentWithoutResource = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: stsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['sts:AssumeRole'],
            Resource: [`arn:aws:sts:${region}:123456789123:role/*`],
          },
        ],
      };
      service.getVpcePolicy = jest.fn().mockReturnValue(policyDocumentWithoutResource);
      const policyDocumentWithResource = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: stsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['sts:AssumeRole'],
            Resource: [`arn:aws:sts:${region}:123456789123:role/*`, roleArn],
          },
        ],
      };

      // OPERATE
      await service.addRoleToStsVpcePolicy(new MockEC2(), roleArn, vpceId, stsSidToReplace);

      // CHECK
      expect(mockModifyVpcEndpoint).toHaveBeenCalledWith({
        VpcEndpointId: vpceId,
        PolicyDocument: JSON.stringify(policyDocumentWithResource),
      });
    });

    test('should not modify policy if statement exists and role has already been added', async () => {
      // BUILD
      const policyDocumentWithResource = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: stsSidToReplace,
            Effect: 'Allow',
            Principal: '*',
            Action: ['sts:AssumeRole'],
            Resource: [roleArn],
          },
        ],
      };
      service.getVpcePolicy = jest.fn().mockReturnValue(policyDocumentWithResource);

      // OPERATE
      await service.addRoleToStsVpcePolicy(new MockEC2(), roleArn, vpceId, stsSidToReplace);

      // CHECK
      expect(mockModifyVpcEndpoint).not.toHaveBeenCalled();
    });
  });

  describe('getVpcePolicy', () => {
    test('should return policy document when one exists', async () => {
      // BUILD
      const vpcePolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'SampleSid',
            Effect: 'Allow',
            Principal: '*',
            Action: ['SampleAction'],
            Resource: ['SampleResource'],
          },
        ],
      };
      const vpceEndpoints = [{ VpcEndpointId: vpceId, PolicyDocument: JSON.stringify(vpcePolicy) }];
      const ec2Client = new MockEC2();
      mockDescribeVpcEndpoints = jest.fn().mockReturnValue({ VpcEndpoints: vpceEndpoints });

      // OPERATE
      const policyDocument = await service.getVpcePolicy(ec2Client, vpceId);

      // CHECK
      expect(policyDocument).toEqual(vpcePolicy);
    });

    test('should return basic policy when no VPCE Policy can be found', async () => {
      // BUILD
      const vpceEndpoints = [];
      const ec2Client = new MockEC2();
      mockDescribeVpcEndpoints = jest.fn().mockReturnValue({ VpcEndpoints: vpceEndpoints });

      // OPERATE
      const policyDocument = await service.getVpcePolicy(ec2Client, vpceId);

      // CHECK
      expect(policyDocument).toEqual({ Version: '2012-10-17', Statement: [] });
    });
  });

  describe('getVpceIdFromStudy', () => {
    test('should return the ID of the KMS VPCE attached to the study', async () => {
      // BUILD
      studyService.mustFind = jest.fn().mockReturnValue(projectId);
      projectService.getAccountForProjectId = jest.fn().mockReturnValue(accountEntity);
      awsCfnService.getKmsVpcEndpointId = jest.fn().mockReturnValue(vpceId);

      // OPERATE
      const vpceIdResult = await service.getVpceIdFromStudy(requestContext, studyEntity, 'KMS');

      // CHECK
      expect(vpceIdResult).toEqual(vpceId);
    });

    test('should return the ID of the STS VPCE attached to the study', async () => {
      // BUILD
      studyService.mustFind = jest.fn().mockReturnValue(projectId);
      projectService.getAccountForProjectId = jest.fn().mockReturnValue(accountEntity);
      awsCfnService.getStsVpcEndpointId = jest.fn().mockReturnValue(vpceId);

      // OPERATE
      const vpceIdResult = await service.getVpceIdFromStudy(requestContext, studyEntity, 'STS');

      // CHECK
      expect(vpceIdResult).toEqual(vpceId);
    });

    test('should throw error if VPCE Service Name is not supported', async () => {
      // BUILD
      studyService.mustFind = jest.fn().mockReturnValue(projectId);
      projectService.getAccountForProjectId = jest.fn().mockReturnValue(accountEntity);
      awsCfnService.getKmsVpcEndpointId = jest.fn().mockReturnValue(vpceId);

      // OPERATE n CHECK
      await expect(service.getVpceIdFromStudy(requestContext, studyEntity, 'TBD')).rejects.toThrow();
    });
  });
});
