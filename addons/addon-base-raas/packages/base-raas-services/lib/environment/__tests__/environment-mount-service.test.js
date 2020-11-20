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
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/iam/iam-service');
const IamServiceMock = require('@aws-ee/base-services/lib/iam/iam-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../../study/study-service');
const StudyServiceMock = require('../../study/study-service');

jest.mock('../../storage-gateway/storage-gateway-service');
const StorageGatewayServiceMock = require('../../storage-gateway/storage-gateway-service');

jest.mock('../../study/study-permission-service');
const StudyPermissionServiceMock = require('../../study/study-permission-service');

jest.mock('../service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('../service-catalog/environment-sc-service');

jest.mock('../env-resource-usage-tracker-service');
const EnvResourceUsageTrackerServiceMock = require('../env-resource-usage-tracker-service');

const EnvironmentMountService = require('../environment-mount-service');

describe('EnvironmentMountService', () => {
  let service = null;
  let environmentScService = null;
  let iamService = null;
  let envResourceUsageTrackerService = null;
  let settings = null;
  let lockService = null;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('envResourceUsageTrackerService', new EnvResourceUsageTrackerServiceMock());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('environmentMountService', new EnvironmentMountService());
    container.register('studyService', new StudyServiceMock());
    container.register('studyPermissionService', new StudyPermissionServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('iamService', new IamServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('storageGatewayService', new StorageGatewayServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentMountService');
    settings = await container.find('settings');
    environmentScService = await container.find('environmentScService');
    iamService = await container.find('iamService');
    lockService = await container.find('lockService');
    envResourceUsageTrackerService = await container.find('envResourceUsageTrackerService');
  });

  describe('Update paths', () => {
    it('should call nothing if all are admin changes', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'admin' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).not.toHaveBeenCalled();
      expect(service.removePermissions).not.toHaveBeenCalled();
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should call add when only adds are requested', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).toHaveBeenCalledWith([{ uid: 'User1-UID', permissionLevel: 'readonly' }], studyId);
      expect(service.removePermissions).not.toHaveBeenCalled();
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should call remove when only removals are requested', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'admin' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).not.toHaveBeenCalled();
      expect(service.removePermissions).toHaveBeenCalledWith(
        [{ uid: 'User2-UID', permissionLevel: 'readwrite' }],
        studyId,
        updateRequest,
      );
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should call update when only updates are requested', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).not.toHaveBeenCalled();
      expect(service.removePermissions).not.toHaveBeenCalled();
      // We send a list of all users in the remove list, who are also present in the add list.
      expect(service.updatePermissions).toHaveBeenCalledWith(
        [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
        studyId,
        updateRequest,
      );
    });

    it('should call everything when everything', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).toHaveBeenCalled();
      expect(service.removePermissions).not.toHaveBeenCalled();
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should not call putRolePolicy when user does not own any environments', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      environmentScService.getActiveEnvsForUser = jest.fn(); // No environments returned
      iamService.putRolePolicy = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).not.toHaveBeenCalled();
    });

    it('should not call putRolePolicy when environment does not have the study mounted', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyB'] }]; // StudyA not mounted on env
      service.addPermissions = jest.fn();
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).not.toHaveBeenCalled();
    });

    it('should call putRolePolicy with added statements when needed', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [],
              },
            },
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should call putRolePolicy with added resources when statement exists', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket'],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath'],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should call putRolePolicy with removed statements when needed', async () => {
      // BUILD
      const updateRequest = {
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [],
              },
            },
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should call putRolePolicy with remove resources when statement exists', async () => {
      // BUILD
      const updateRequest = {
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket'],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath'],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should call putRolePolicy after adding and removing statements for update when needed', async () => {
      // BUILD
      const updateRequest = {
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should call putRolePolicy after adding and removing resources for update when statements exist', async () => {
      // BUILD
      const updateRequest = {
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [studyPrefix, 'StudyPrefix_ABC', 'StudyPrefix_XYZ'],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['StudyBucketPath_ABC', `${studyBucket}/${studyPrefix}`],
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: ['StudyBucketPath_XYZ'],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': [studyPrefix, 'StudyPrefix_ABC', 'StudyPrefix_XYZ'],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['StudyBucketPath_ABC'],
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: ['StudyBucketPath_XYZ', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should ensure study admins have at least R/O access after R/O permission removal', async () => {
      // BUILD
      const updateRequest = {
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should ensure study admins have at least R/O access after R/W permission removal', async () => {
      // BUILD
      const updateRequest = {
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: ['AnotherStudyBucketPath'],
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should ensure study admins have only one access level after R/W permission addition', async () => {
      // BUILD

      const updateRequest = {
        usersToAdd: [
          { uid: 'User1-UID', permissionLevel: 'admin' },
          { uid: 'User1-UID', permissionLevel: 'readwrite' },
        ],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath'],
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should ensure duplicate resources are not created for admins after R/O permission addition', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [
          { uid: 'User1-UID', permissionLevel: 'admin' },
          { uid: 'User1-UID', permissionLevel: 'readonly' },
        ],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should ensure duplicate resources are not created for non-admins after permission addition from a bad state', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath'],
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should ensure permission updates for admins are as expected', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [
          { uid: 'User1-UID', permissionLevel: 'admin' },
          { uid: 'User1-UID', permissionLevel: 'readonly' },
        ],
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath'],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });

    it('should ensure permission updates when admins are removed are as expected', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyA'] }];
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();
      const studyBucket = 'arn:aws:s3:::xxxxxxxx-namespace-studydata';
      const studyPrefix = 'studies/Organization/SampleStudy/*';
      const inputPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath', `${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      const IamUpdateParams = {
        iamClient: 'sampleIamClient',
        studyPathArn: `${studyBucket}/${studyPrefix}`,
        policyDoc: inputPolicy,
        roleName: 'sampleRoleName',
        studyDataPolicyName: 'sampleStudyDataPolicy',
      };
      const expectedPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'studyKMSAccess',
            Action: ['Permission1', 'Permission2'],
            Effect: 'Allow',
            Resource: 'arn:aws:kms:region:xxxxxxxx:key/someRandomString',
          },
          {
            Sid: 'studyListS3AccessN',
            Effect: 'Allow',
            Action: 's3:ListBucket',
            Resource: studyBucket,
            Condition: {
              StringLike: {
                's3:prefix': ['AnotherStudyPrefixForThisBucket', studyPrefix],
              },
            },
          },
          {
            Sid: 'S3StudyReadAccess',
            Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: ['AnotherStudyBucketPath'],
          },
          {
            Sid: 'S3StudyReadWriteAccess',
            Effect: 'Allow',
            Action: [
              's3:GetObject',
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: [`${studyBucket}/${studyPrefix}`],
          },
        ],
      };
      service._getIamUpdateParams = jest.fn().mockResolvedValue(IamUpdateParams);

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).toHaveBeenCalledWith(
        IamUpdateParams.roleName,
        IamUpdateParams.studyDataPolicyName,
        JSON.stringify(IamUpdateParams.policyDoc),
        IamUpdateParams.iamClient,
      );
      expect(IamUpdateParams.policyDoc).toMatchObject(expectedPolicy);
    });
  });

  describe('S3 bucket policy management paths', () => {
    it('should add new member account root as new principal in S3 bucket policy when envResourceUsageTracker reports count as 1', async () => {
      // BUILD
      const requestContext = {};
      const envId = 'sampleEnvId';
      const memberAccountRoot = 'memberAccountID';
      const s3Prefixes = ['studyA'];
      const existingS3BucketPolicy = {
        Version: '2012-10-17',
        Id: 'RandomExistingPolicy',
        Statement: [
          {
            Sid: 'Deny object uploads not using default encryption settings',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:PutObject',
            Resource: 'arn:aws:s3:::mainAccountId-namespace-studydata/*',
            Condition: {
              StringNotEqualsIfExists: {
                's3:x-amz-server-side-encryption': 'aws:kms',
              },
              Null: {
                's3:x-amz-server-side-encryption': 'false',
              },
            },
          },
        ],
      };
      const existingKmsPolicy = {
        Version: '2012-10-17',
        Id: 'study-data-kms-policy',
        Statement: [],
      };
      envResourceUsageTrackerService.addEnvironmentResourceUse = jest.fn().mockResolvedValue({ count: 1 });
      const bucketNameOrKmsAlias = 'sampleBucketOrKmsString';
      const studyId = 'studyA';
      settings.get = jest.fn(() => bucketNameOrKmsAlias);
      service._putBucketPolicy = jest.fn();
      service._getKmsKeyPolicy = jest.fn().mockResolvedValue(JSON.stringify(existingKmsPolicy));
      service._putKmsKeyPolicy = jest.fn();
      service._describeKmsKey = jest.fn();
      service._getBucketPolicy = jest.fn().mockResolvedValue(JSON.stringify(existingS3BucketPolicy));
      jest.spyOn(service, '_updateResourcePolicies');
      const expectedBucketPolicy = {
        Version: '2012-10-17',
        Id: 'RandomExistingPolicy',
        Statement: [
          {
            Sid: 'Deny object uploads not using default encryption settings',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:PutObject',
            Resource: 'arn:aws:s3:::mainAccountId-namespace-studydata/*',
            Condition: {
              StringNotEqualsIfExists: {
                's3:x-amz-server-side-encryption': 'aws:kms',
              },
              Null: {
                's3:x-amz-server-side-encryption': 'false',
              },
            },
          },
          {
            Sid: `List:${studyId}`,
            Effect: 'Allow',
            Principal: { AWS: [memberAccountRoot] },
            Action: 's3:ListBucket',
            Resource: `arn:aws:s3:::${bucketNameOrKmsAlias}`,
            Condition: {
              StringLike: {
                's3:prefix': [`${studyId}*`],
              },
            },
          },
          {
            Sid: `Get:${studyId}`,
            Effect: 'Allow',
            Principal: { AWS: [memberAccountRoot] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketNameOrKmsAlias}/${studyId}*`],
          },
          {
            Sid: `Put:${studyId}`,
            Effect: 'Allow',
            Principal: { AWS: [memberAccountRoot] },
            Action: [
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: [`arn:aws:s3:::${bucketNameOrKmsAlias}/${studyId}*`],
          },
        ],
      };

      // Mock locking so that the putBucketPolicy actually gets called
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

      // OPERATE
      await service.addRoleArnToLocalResourcePolicies(requestContext, envId, memberAccountRoot, s3Prefixes);

      // CHECK
      expect(service._updateResourcePolicies).toHaveBeenCalled();
      expect(service._putBucketPolicy).toHaveBeenCalledWith('sampleBucketOrKmsString', expectedBucketPolicy);
    });

    it('should delete member account root access from S3 bucket policy when envResourceUsageTracker reports count as 0', async () => {
      // BUILD
      const requestContext = {};
      const envId = 'sampleEnvId';
      const memberAccountRoot = 'memberAccountID';
      const s3Prefixes = ['studyA'];

      const existingKmsPolicy = {
        Version: '2012-10-17',
        Id: 'study-data-kms-policy',
        Statement: [],
      };
      envResourceUsageTrackerService.deleteEnvironmentResourceUse = jest.fn().mockResolvedValue({ count: 0 });
      const bucketNameOrKmsAlias = 'sampleBucketOrKmsString';
      const studyId = 'studyA';
      settings.get = jest.fn(() => bucketNameOrKmsAlias);
      jest.spyOn(service, '_updateResourcePolicies');
      const existingS3BucketPolicy = {
        Version: '2012-10-17',
        Id: 'RandomExistingPolicy',
        Statement: [
          {
            Sid: 'Deny object uploads not using default encryption settings',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:PutObject',
            Resource: 'arn:aws:s3:::mainAccountId-namespace-studydata/*',
            Condition: {
              StringNotEqualsIfExists: {
                's3:x-amz-server-side-encryption': 'aws:kms',
              },
              Null: {
                's3:x-amz-server-side-encryption': 'false',
              },
            },
          },
          {
            Sid: `List:${studyId}`,
            Effect: 'Allow',
            Principal: { AWS: [memberAccountRoot] },
            Action: 's3:ListBucket',
            Resource: `arn:aws:s3:::${bucketNameOrKmsAlias}`,
            Condition: {
              StringLike: {
                's3:prefix': [`${studyId}*`],
              },
            },
          },
          {
            Sid: `Get:${studyId}`,
            Effect: 'Allow',
            Principal: { AWS: [memberAccountRoot] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketNameOrKmsAlias}/${studyId}*`],
          },
          {
            Sid: `Put:${studyId}`,
            Effect: 'Allow',
            Principal: { AWS: [memberAccountRoot] },
            Action: [
              's3:AbortMultipartUpload',
              's3:ListMultipartUploadParts',
              's3:PutObject',
              's3:PutObjectAcl',
              's3:DeleteObject',
            ],
            Resource: [`arn:aws:s3:::${bucketNameOrKmsAlias}/${studyId}*`],
          },
        ],
      };
      const expectedBucketPolicy = {
        Version: '2012-10-17',
        Id: 'RandomExistingPolicy',
        Statement: [
          {
            Sid: 'Deny object uploads not using default encryption settings',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:PutObject',
            Resource: 'arn:aws:s3:::mainAccountId-namespace-studydata/*',
            Condition: {
              StringNotEqualsIfExists: {
                's3:x-amz-server-side-encryption': 'aws:kms',
              },
              Null: {
                's3:x-amz-server-side-encryption': 'false',
              },
            },
          },
        ],
      };
      service._putBucketPolicy = jest.fn();
      service._getKmsKeyPolicy = jest.fn().mockResolvedValue(JSON.stringify(existingKmsPolicy));
      service._putKmsKeyPolicy = jest.fn();
      service._describeKmsKey = jest.fn();
      service._getBucketPolicy = jest.fn().mockResolvedValue(JSON.stringify(existingS3BucketPolicy));

      // Mock locking so that the putBucketPolicy actually gets called
      lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

      // OPERATE
      await service.removeRoleArnFromLocalResourcePolicies(requestContext, envId, memberAccountRoot, s3Prefixes);

      // CHECK
      expect(service._updateResourcePolicies).toHaveBeenCalled();
      expect(service._putBucketPolicy).toHaveBeenCalledWith('sampleBucketOrKmsString', expectedBucketPolicy);
    });
  });
});
