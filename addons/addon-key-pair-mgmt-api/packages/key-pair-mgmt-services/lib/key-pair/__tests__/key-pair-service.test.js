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
const JsonSchemaValidationService = require('@amzn/base-services/lib/json-schema-validation-service');

jest.mock('@amzn/base-services/lib/db-service');
const DbServiceMock = require('@amzn/base-services/lib/db-service');

jest.mock('@amzn/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@amzn/base-services/lib/audit/audit-writer-service');

jest.mock('@amzn/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@amzn/base-services/lib/authorization/authorization-service');

jest.mock('@amzn/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');

const KeyPairService = require('../key-pair-service');

describe('keyPairService', () => {
  let service = null;
  let dbService = null;
  beforeEach(async () => {
    // initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('keyPairService', new KeyPairService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('keyPairService');
    dbService = await container.find('dbService');

    // skip authorization
    service.assertAuthorized = jest.fn();
    service.isAuthorized = jest.fn();
  });

  describe('create', () => {
    const requestContext = {
      principalIdentifier: {
        uid: 'UID',
      },
    };

    describe('if the name is invalid', () => {
      const keyPair = {
        name: '<script>console.log("**hacker voice** I\'m in")</script>',
      };

      it('should fail', async () => {
        // OPERATE and CHECK
        await expect(service.create(requestContext, keyPair)).rejects.toThrow(
          expect.objectContaining({
            boom: true,
            code: 'badRequest',
            safe: true,
            message: 'Input has validation errors',
          }),
        );
      });
    });

    describe('if the name is valid', () => {
      const keyPair = {
        name: 'valid-key-name',
      };

      it('should pass', async () => {
        // BUILD
        service.audit = jest.fn();

        // OPERATE
        await service.create(requestContext, keyPair);

        // CHECK
        // expect(dbService.table.key).toHaveBeenCalledWith({ id: keyPair.id });
        expect(dbService.table.update).toHaveBeenCalled();
        expect(service.audit).toHaveBeenCalledWith(
          requestContext,
          expect.objectContaining({ action: 'create-key-pair' }),
        );
      });
    });
  });

  describe('update', () => {
    const requestContext = {
      principalIdentifier: {
        uid: 'UID',
      },
    };

    describe('if the name is invalid', () => {
      const keyPair = {
        id: 'id',
        name: '<script>console.log("**hacker voice** I\'m in")</script>',
      };

      it('should fail', async () => {
        // OPERATE and CHECK
        await expect(service.update(requestContext, keyPair)).rejects.toThrow(
          expect.objectContaining({
            boom: true,
            code: 'badRequest',
            safe: true,
            message: 'Input has validation errors',
          }),
        );
      });
    });

    describe('if the name is valid', () => {
      const keyPair = {
        id: 'valid-id',
        name: 'valid-key-name',
        rev: 0,
      };

      const existingKeyPair = {
        principalIdentifier: requestContext.principalIdentifier,
      };

      it('should pass', async () => {
        // BUILD
        service.audit = jest.fn();
        service.mustFind = jest.fn().mockReturnValue(existingKeyPair);

        // OPERATE
        await service.update(requestContext, keyPair);

        // CHECK
        expect(dbService.table.key).toHaveBeenCalledWith({ id: keyPair.id });
        expect(dbService.table.update).toHaveBeenCalled();
        expect(service.audit).toHaveBeenCalledWith(
          requestContext,
          expect.objectContaining({ action: 'update-key-pair' }),
        );
      });
    });
  });
});
