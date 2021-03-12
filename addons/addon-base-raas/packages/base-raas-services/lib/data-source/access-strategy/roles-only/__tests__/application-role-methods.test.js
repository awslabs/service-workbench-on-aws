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

// Mocked services
const {
  toAppRoleEntity,
  toDbEntity,
  newAppRoleEntity,
  addStudy,
  maxReached,
  toCfnResources,
} = require('../helpers/entities/application-role-methods');

const createStudy = ({
  id = 'study-1',
  category = 'Organization',
  accountId = '1122334455',
  awsPartition = 'aws',
  bucketAccess = 'roles',
  kmsArn = undefined,
  bucket = 'bucket-1',
  qualifier = 'swb-IhsKhN8GsLneiis11ujlb8',
  appRoleArn = 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
  accessType = 'readwrite',
  envPermission = { read: true, write: true },
  folder = '/',
  kmsScope = 'none',
} = {}) => ({
  id,
  category,
  accountId,
  awsPartition,
  bucketAccess,
  bucket,
  qualifier,
  appRoleArn,
  kmsArn,
  accessType,
  envPermission,
  folder,
  kmsScope,
});

const createAppRole = ({
  arn = 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
  accountId = '1122334455',
  mainRegion = 'us-east-1',
  awsPartition = 'aws',
  bucket = 'bucket-1',
  by = 'sampleUser',
  bucketRegion = 'us-east-1',
  status = 'pending',
  name = 'swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
  qualifier = 'swb-IhsKhN8GsLneiis11ujlb8',
  boundaryPolicyArn = 'arn:aws:iam::123456789012:policy/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
  studies = {
    'study-1': {
      accessType: 'readonly',
      kmsScope: 'none',
      folder: '/',
    },
  },
} = {}) => ({
  accountId,
  arn,
  name,
  mainRegion,
  by,
  awsPartition,
  bucket,
  bucketRegion,
  status,
  qualifier,
  boundaryPolicyArn,
  studies,
});

describe('toAppRoleEntity', () => {
  it('ensures toAppRoleEntity does not fail with undefined dbEntity', async () => {
    // EXECUTE & CHECK
    expect(toAppRoleEntity()).toStrictEqual(undefined);
  });

  it('ensures toAppRoleEntity does not fail with valid dbEntity', async () => {
    const expectedAppRoleEntity = createAppRole();
    const dbEntity = {
      awsPartition: 'aws',
      boundaryPolicyArn: 'arn:aws:iam::123456789012:policy/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      bucket: 'bucket-1',
      pk: 'ACT#1122334455',
      sk: 'APP#bucket-1#arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      bucketRegion: 'us-east-1',
      by: 'sampleUser',
      mainRegion: 'us-east-1',
      name: 'swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      qualifier: 'swb-IhsKhN8GsLneiis11ujlb8',
      status: 'pending',
      studies: { 'study-1': { accessType: 'readonly', folder: '/', kmsScope: 'none' } },
    };

    // EXECUTE & CHECK
    expect(toAppRoleEntity(dbEntity)).toStrictEqual(expectedAppRoleEntity);
  });
});

describe('toDbEntity', () => {
  it('ensures toDbEntity does not fail with valid appRoleEntity', async () => {
    // BUILD
    const appRole = createAppRole();
    const by = 'sampleUserUid';
    const expectedDbEntity = {
      arn: 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      awsPartition: 'aws',
      boundaryPolicyArn: 'arn:aws:iam::123456789012:policy/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      bucket: 'bucket-1',
      bucketRegion: 'us-east-1',
      by: 'sampleUser',
      createdBy: 'sampleUserUid',
      mainRegion: 'us-east-1',
      name: 'swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      qualifier: 'swb-IhsKhN8GsLneiis11ujlb8',
      status: 'pending',
      studies: { 'study-1': { accessType: 'readonly', folder: '/', kmsScope: 'none' } },
      updatedBy: 'sampleUserUid',
    };

    // EXECUTE & CHECK
    expect(toDbEntity(appRole, by)).toStrictEqual(expectedDbEntity);
  });
});

describe('newAppRoleEntity', () => {
  it('ensures newAppRoleEntity creates a new valid appRoleEntity', async () => {
    // BUILD
    const studyEntity = createStudy();
    const accountEntity = { mainRegion: 'us-east-1' };
    const bucketEntity = { kmsArn: 'sampleKmsArn' };
    const expectedAppRole = {
      accountId: '1122334455',
      awsPartition: 'aws',
      bucket: 'bucket-1',
      bucketKmsArn: 'sampleKmsArn',
      bucketRegion: undefined,
      mainRegion: 'us-east-1',
      qualifier: 'swb-IhsKhN8GsLneiis11ujlb8',
      status: 'pending',
      studies: { 'study-1': { accessType: 'readwrite', folder: '/', kmsArn: undefined, kmsScope: 'none' } },
    };

    // EXECUTE & CHECK
    const returnVal = newAppRoleEntity(accountEntity, bucketEntity, studyEntity);
    expect(returnVal).toEqual(expect.objectContaining(expectedAppRole));
  });
});

describe('addStudy', () => {
  it('ensures addStudy adds a study correctly to appRoleEntity', async () => {
    // BUILD
    const studyEntity = {
      id: 'study-2',
      accessType: 'readwrite',
      folder: '/',
      kmsScope: 'none',
      kmsArn: 'sampleKmsArn',
    };
    const appRoleEntity = createAppRole();
    const expectedAppRoleEntity = {
      accountId: '1122334455',
      arn: 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      awsPartition: 'aws',
      boundaryPolicyArn: 'arn:aws:iam::123456789012:policy/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      bucket: 'bucket-1',
      bucketRegion: 'us-east-1',
      by: 'sampleUser',
      mainRegion: 'us-east-1',
      name: 'swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
      qualifier: 'swb-IhsKhN8GsLneiis11ujlb8',
      status: 'pending',
      studies: {
        'study-1': { accessType: 'readonly', folder: '/', kmsScope: 'none' },
        'study-2': { accessType: 'readwrite', folder: '/', kmsArn: 'sampleKmsArn', kmsScope: 'none' },
      },
    };

    // EXECUTE & CHECK
    const returnVal = addStudy(appRoleEntity, studyEntity);
    expect(returnVal).toStrictEqual(expectedAppRoleEntity);
  });
});

describe('maxReached', () => {
  it('ensures maxReached returns false when there is space left for characters in object', async () => {
    // BUILD
    const appRoleEntity = createAppRole();

    // EXECUTE & CHECK
    expect(maxReached(appRoleEntity)).toStrictEqual(false);
  });

  it('ensures maxReached returns true when there is no space left for characters in object', async () => {
    // BUILD
    const appRoleEntity = createAppRole();

    // EXECUTE & CHECK
    expect(maxReached(appRoleEntity, 200)).toStrictEqual(true);
  });
});

describe('toCfnResources', () => {
  it('ensures toCfnResources returns managedPolicy and role as expected', async () => {
    // BUILD
    const appRoleEntity = createAppRole();
    const swbMainAccountId = 'sampleAccountId';
    const returnVal = [
      {
        logicalId: 'ManagedPolicyswbIhsKhN8GsLneiis11ujlb8app1234567890xxx',
        resource: {
          Properties: {
            Description:
              'A managed policy that is used as the permission boundary for all roles that are created by SWB',
            ManagedPolicyName: 'swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
            PolicyDocument: {
              Statement: [
                {
                  Action: [
                    's3:GetObject',
                    's3:GetObjectTagging',
                    's3:GetObjectTorrent',
                    's3:GetObjectVersion',
                    's3:GetObjectVersionTagging',
                    's3:GetObjectVersionTorrent',
                  ],
                  Effect: 'Allow',
                  Resource: ['arn:aws:s3:::bucket-1/*'],
                  Sid: 'S3StudyReadAccess',
                },
                {
                  Action: ['s3:ListBucket', 's3:ListBucketVersions'],
                  Condition: { StringLike: { 's3:prefix': ['*'] } },
                  Effect: 'Allow',
                  Resource: 'arn:aws:s3:::bucket-1',
                  Sid: 'studyListS3Access1',
                },
              ],
              Version: '2012-10-17',
            },
          },
          Type: 'AWS::IAM::ManagedPolicy',
        },
      },
      {
        logicalId: 'AppRoleswbIhsKhN8GsLneiis11ujlb8app1234567890xxx',
        resource: {
          Properties: {
            AssumeRolePolicyDocument: {
              Statement: [{ Action: ['sts:AssumeRole'], Effect: 'Allow', Principal: { AWS: 'sampleAccountId' } }],
              Version: '2012-10-17',
            },
            Description: 'An application role that allows the SWB application to create roles to access studies',
            ManagedPolicyArns: [{ Ref: 'ManagedPolicyswbIhsKhN8GsLneiis11ujlb8app1234567890xxx' }],
            MaxSessionDuration: 43200,
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    {
                      Action: [
                        'iam:CreatePolicy',
                        'iam:UpdateAssumeRolePolicy',
                        'iam:AttachRolePolicy',
                        'iam:PutRolePolicy',
                        'iam:DeletePolicy',
                        'iam:DeleteRolePolicy',
                        'iam:DeleteRole',
                        'iam:GetPolicy',
                        'iam:GetRole',
                        'iam:GetRolePolicy',
                      ],
                      Effect: 'Allow',
                      Resource: [
                        'arn:aws:iam::1122334455:role/swb-IhsKhN8GsLneiis11ujlb8-*',
                        'arn:aws:iam::1122334455:policy/swb-IhsKhN8GsLneiis11ujlb8-*',
                      ],
                      Sid: 'RoleAndPolicyManagement',
                    },
                    {
                      Action: 'iam:CreateRole',
                      Condition: {
                        StringEquals: {
                          'iam:PermissionsBoundary':
                            'arn:aws:iam::123456789012:policy/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
                        },
                      },
                      Effect: 'Allow',
                      Resource: 'arn:aws:iam::1122334455:role/swb-IhsKhN8GsLneiis11ujlb8-*',
                      Sid: 'RoleCreation',
                    },
                  ],
                  Version: '2012-10-17',
                },
                PolicyName: 'swb-app-role-essentials',
              },
            ],
            RoleName: 'swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
          },
          Type: 'AWS::IAM::Role',
        },
      },
    ];

    // EXECUTE & CHECK
    expect(toCfnResources(appRoleEntity, swbMainAccountId)).toStrictEqual(returnVal);
  });
});
