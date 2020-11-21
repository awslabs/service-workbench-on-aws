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

const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const AuthService = require('@aws-ee/base-services/lib/authorization/authorization-service');
const AuditService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const StudyAuthzService = require('../study-authz-service');

describe('StudyAuthzService', () => {
  let service;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('dbService', new DbService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('settings', new SettingsService());
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('authorizationService', new AuthService());
    container.register('auditWriterService', new AuditService());
    container.register('studyAuthzService', new StudyAuthzService());
    await container.initServices();

    service = await container.find('studyAuthzService');
  });

  describe('get-study-permissions', () => {
    it('inactive users are not allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'admin', status: 'inactive' } };
      const action = 'get-study-permissions';
      const studyPermissionsEntity = {};

      await expect(service.authorize(requestContext, { action }, { studyPermissionsEntity })).resolves.toEqual(
        expect.objectContaining({ effect: 'deny' }),
      );
    });

    it('admins are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'admin', status: 'active' } };
      const action = 'get-study-permissions';
      const studyPermissionsEntity = {};

      await expect(service.authorize(requestContext, { action }, { studyPermissionsEntity })).resolves.toEqual(
        expect.objectContaining({ effect: 'allow' }),
      );
    });

    it('users who have admin access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const action = 'get-study-permissions';
      const studyPermissionsEntity = { adminUsers: [uid] };

      await expect(service.authorize(requestContext, { action }, { studyPermissionsEntity })).resolves.toEqual(
        expect.objectContaining({ effect: 'allow' }),
      );
    });

    it('users who have read only access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const action = 'get-study-permissions';
      const studyPermissionsEntity = { readonlyUsers: [uid] };

      await expect(service.authorize(requestContext, { action }, { studyPermissionsEntity })).resolves.toEqual(
        expect.objectContaining({ effect: 'allow' }),
      );
    });

    it('users who have read write access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const action = 'get-study-permissions';
      const studyPermissionsEntity = { readwriteUsers: [uid] };

      await expect(service.authorize(requestContext, { action }, { studyPermissionsEntity })).resolves.toEqual(
        expect.objectContaining({ effect: 'allow' }),
      );
    });

    it('users who have write only access to the study are allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const action = 'get-study-permissions';
      const studyPermissionsEntity = { writeonlyUsers: [uid] };

      await expect(service.authorize(requestContext, { action }, { studyPermissionsEntity })).resolves.toEqual(
        expect.objectContaining({ effect: 'allow' }),
      );
    });

    it('users who do not have access to the study are not allowed', async () => {
      const uid = 'u-currentUserId';
      const requestContext = { principalIdentifier: { uid }, principal: { userRole: 'researcher', status: 'active' } };
      const action = 'get-study-permissions';
      const studyPermissionsEntity = {};

      await expect(service.authorize(requestContext, { action }, { studyPermissionsEntity })).resolves.toEqual(
        expect.objectContaining({ effect: 'deny' }),
      );
    });
  });
});
