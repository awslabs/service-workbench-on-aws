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

const AwsAccountService = require('../aws-accounts-service');

describe('AwsAccountService', () => {
  let service = null;
  let dbService = null;
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
    container.register('awsAccountService', new AwsAccountService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('awsAccountService');
    dbService = await container.find('dbService');
  });

  describe('find', () => {
    it('should return undefined for external guests', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'guest' } };
      const params = { id: '123', fields: [] };
      // OPERATE
      const response = await service.find(requestContext, params);
      // CHECK
      expect(response).toBe(undefined);
    });

    it('should return undefined for external researchers', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'external-researcher' } };
      const params = { id: '123', fields: [] };
      // OPERATE
      const response = await service.find(requestContext, params);
      // CHECK
      expect(response).toBe(undefined);
    });

    it('should return undefined for internal guests', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'internal-guest' } };
      const params = { id: '123', fields: [] };
      // OPERATE
      const response = await service.find(requestContext, params);
      // CHECK
      expect(response).toBe(undefined);
    });

    it('should return an aws account record successfully', async () => {
      // BUILD
      const requestContext = { principal: { userRole: 'admin' } };
      const params = { id: '123', fields: ['accountId', 'description'] };

      // Mock response from a get() to dynamodb
      dbService.table.get.mockReturnValue({
        id: '123',
        accountId: '01234567890',
        description: 'Research account',
      });

      // OPERATE
      const response = await service.find(requestContext, params);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: '123' });
      expect(dbService.table.projection).toHaveBeenCalledWith(['accountId', 'description']);
      expect(response).toMatchObject({
        id: '123',
        accountId: '01234567890',
        description: 'Research account',
      });
    });
  });
});
