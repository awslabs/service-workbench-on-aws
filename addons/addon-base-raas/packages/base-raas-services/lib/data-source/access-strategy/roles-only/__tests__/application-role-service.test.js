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

const DbService = require('@aws-ee/base-services/lib/db-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const ApplicationRoleService = require('../application-role-service');

const createAppRole = ({
  arn = 'arn:aws:iam::123456789012:role/swb-IhsKhN8GsLneiis11ujlb8-app-1234567890xxx',
  accountId = '1122334455',
  mainRegion = 'us-east-1',
  awsPartition = 'aws',
  bucket = 'bucket-1',
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
  awsPartition,
  bucket,
  bucketRegion,
  status,
  qualifier,
  boundaryPolicyArn,
  studies,
});

const settingKeys = {
  tableName: 'dbRoleAllocations',
  swbMainAccount: 'mainAcct',
};

describe('ApplicationRoleService', () => {
  let container;
  let service;
  let dbService;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();

    container.register('dbService', new DbService());
    container.register('roles-only/applicationRoleService', new ApplicationRoleService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('settings', new SettingsService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    await container.initServices();

    service = await container.find('roles-only/applicationRoleService');
    dbService = await container.find('dbService');

    // Skip authorization
    service.assertAuthorized = jest.fn();
  });

  // Find - Found vs unfound (undefined result)

  it('ensures allocateRole does not create new appRole when one exists', async () => {
    // BUILD
    const appRole = createAppRole();
    const studies = ['study-id'];
    const requestContext = 'sampleRequestContext';
    // const env = { studyRoles: { [study.id]: 'role-arn-1' } };
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
    service.list = jest.fn().mockReturnValue([appRole]);

    // EXECUTE
    // await service.allocateRole(requestContext);
    await expect(service.allocateRole(requestContext)).resolves.toStrictEqual(appRole);

    // // CHECK
    // expect(policyDoc.toPolicyDoc()).toStrictEqual(doc);
  });
});
