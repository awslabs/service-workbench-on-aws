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

// Mocked services
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('../../../../environment/service-catalog/environment-sc-service');
jest.mock('../../../data-source-bucket-service');
jest.mock('../application-role-service');
jest.mock('../filesystem-role-service');

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const LockService = require('@aws-ee/base-services/lib/lock/lock-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');

const { StudyPolicy } = require('../../../../helpers/iam/study-policy');
const EnvironmentScService = require('../../../../environment/service-catalog/environment-sc-service');
const DataSourceBucketService = require('../../../data-source-bucket-service');
const ResourceUsageService = require('../../../../usage/resource-usage-service');
const ApplicationRoleService = require('../application-role-service');
const FilesystemRoleService = require('../filesystem-role-service');
const EnvironmentResourceService = require('../environment-resource-service');

const createStudy = ({
  id = 'study-1',
  category = 'Organization',
  accountId = '1122334455',
  awsPartition = 'aws',
  bucketAccess = 'roles',
  bucket = 'bucket-1',
  qualifier = 'swb-IhsKhN8GsLneiis11ujlb8',
  appRoleArn = 'arn:aws:iam::684277579687:role/swb-IhsKhN8GsLneiis11ujlb8-app-1607537845811',
  accessType = 'readwrite',
  envPermission = { read: true, write: true },
  folder = '/',
  kmsScope = 'none',
  region = 'us-east-1',
} = {}) => ({
  id,
  category,
  accountId,
  awsPartition,
  bucketAccess,
  bucket,
  qualifier,
  appRoleArn,
  accessType,
  envPermission,
  folder,
  kmsScope,
  region,
});

const createAdminContext = ({ uid = 'uid-admin' } = {}) => ({
  principalIdentifier: { uid },
  principal: { isAdmin: true, userRole: 'admin', status: 'active' },
});

describe('EnvironmentResourceService', () => {
  let container;
  let service;
  let lockService;
  let fsRoleService;
  let envService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();

    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('lockService', new LockService());
    container.register('dbService', new DbService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('dataSourceBucketService', new DataSourceBucketService());
    container.register('environmentScService', new EnvironmentScService());
    container.register('resourceUsageService', new ResourceUsageService());
    container.register('roles-only/applicationRoleService', new ApplicationRoleService());
    container.register('roles-only/filesystemRoleService', new FilesystemRoleService());
    container.register('roles-only/environmentResourceService', new EnvironmentResourceService());
    await container.initServices();

    service = await container.find('roles-only/environmentResourceService');
    lockService = await container.find('lockService');
    fsRoleService = await container.find('roles-only/filesystemRoleService');
    envService = await container.find('environmentScService');
  });

  it('provides env role policy', async () => {
    const requestContext = createAdminContext();
    const policyDoc = new StudyPolicy();
    const study = createStudy();
    const studies = [study];
    const env = { studyRoles: { [study.id]: 'role-arn-1' } };
    const doc = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'studyAssumeRoles',
          Action: ['sts:AssumeRole'],
          Effect: 'Allow',
          Resource: ['role-arn-1'],
        },
      ],
    };

    await expect(
      service.provideEnvRolePolicy(requestContext, { policyDoc, studies, environmentScEntity: env }),
    ).resolves.toStrictEqual(expect.objectContaining({ roleArns: ['role-arn-1'], studies: {} }));

    expect(policyDoc.toPolicyDoc()).toStrictEqual(doc);
  });

  it('provides study mounts', async () => {
    const requestContext = createAdminContext();
    const study = createStudy();
    const studies = [study];
    const env = { studyRoles: { [study.id]: 'role-arn-1' } };
    const s3Mounts = [];
    const mount = [
      {
        bucket: 'bucket-1',
        id: 'study-1',
        kmsArn: undefined,
        prefix: '/',
        readable: true,
        region: 'us-east-1',
        roleArn: 'role-arn-1',
        writeable: true,
      },
    ];

    await expect(
      service.provideStudyMount(requestContext, { studies, s3Mounts, environmentScEntity: env }),
    ).resolves.toStrictEqual(mount);
  });

  it('allocates study resources', async () => {
    const requestContext = createAdminContext();
    const study = createStudy();
    const studies = [study];
    const env = { studyRoles: { [study.id]: 'role-arn-1' } };
    const memberAccountId = '1234';

    lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
      return fn();
    });

    fsRoleService.allocateRole = jest.fn(() => ({
      arn: 'fs-arn-1',
    }));

    envService.updateStudyRoles = jest.fn();

    await expect(
      service.allocateStudyResources(requestContext, { studies, environmentScEntity: env, memberAccountId }),
    ).resolves.toBeUndefined();

    expect(fsRoleService.allocateRole).toHaveBeenCalledTimes(1);
    expect(envService.updateStudyRoles).toHaveBeenCalledTimes(1);
  });

  it('de-allocates study resources', async () => {
    const requestContext = createAdminContext();
    const study = createStudy();
    const studies = [study];
    const env = { studyRoles: { [study.id]: 'role-arn-1' } };
    const memberAccountId = '1234';

    lockService.tryWriteLockAndRun = jest.fn((_id, fn) => {
      return fn();
    });

    fsRoleService.deallocateRole = jest.fn();
    envService.updateStudyRoles = jest.fn();

    await expect(
      service.deallocateStudyResources(requestContext, { studies, environmentScEntity: env, memberAccountId }),
    ).resolves.toBeUndefined();

    expect(fsRoleService.deallocateRole).toHaveBeenCalledTimes(1);
    expect(envService.updateStudyRoles).toHaveBeenCalledTimes(1);
  });
});
