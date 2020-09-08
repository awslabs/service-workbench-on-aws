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
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

// Mocked dependencies
jest.mock('@aws-ee/base-api-services/lib/jwt-service');
const JwtService = require('@aws-ee/base-api-services/lib/jwt-service');

jest.mock('@aws-ee/key-pair-mgmt-services/lib/key-pair/key-pair-service');
const KeyPairServiceMock = require('@aws-ee/key-pair-mgmt-services/lib/key-pair/key-pair-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryServiceMock = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('../../environment-dns-service.js');
const EnvironmentDnsServiceMock = require('../../environment-dns-service.js');

jest.mock('../environment-sc-service');
const EnvironmentSCServiceMock = require('../environment-sc-service');

jest.mock('../environment-sc-keypair-service');
const EnvironmentScKeyPairServiceMock = require('../environment-sc-keypair-service');

const EnvironmentScConnectionService = require('../environment-sc-connection-service');

describe('EnvironmentScConnectionService', () => {
  let service = null;
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('jwtService', new JwtService());
    container.register('log', new Logger());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('pluginRegistryService', new PluginRegistryServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('environmentDnsService', new EnvironmentDnsServiceMock());
    container.register('keyPairService', new KeyPairServiceMock());
    container.register('environmentScKeypairService', new EnvironmentScKeyPairServiceMock());
    container.register('environmentScService', new EnvironmentSCServiceMock());
    container.register('environmentScConnectionService', new EnvironmentScConnectionService());
    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('environmentScConnectionService');
  });

  describe('create connection', () => {
    it('should return connection if exists', async () => {
      // BUILD
      const connection = { url: 'www.example.com', info: 'An already existing connection' };
      service.mustFindConnection = jest.fn(() => connection);

      // OPERATE
      const retConn = await service.createConnectionUrl();

      // CHECK
      expect(retConn).toBe(connection);
    });

    it('should get RStudio connection URL for RStudio connection types', async () => {
      // BUILD
      const connection = { type: 'RStudio' };
      service.mustFindConnection = jest.fn(() => connection);
      service.getRStudioUrl = jest.fn();

      // OPERATE
      await service.createConnectionUrl();

      // CHECK
      expect(service.getRStudioUrl).toHaveBeenCalled();
    });

    it('should NOT get RStudio connection URL for non-RStudio connection types', async () => {
      // BUILD
      const connection = { type: 'nonRStudio' };
      service.mustFindConnection = jest.fn(() => connection);
      service.getRStudioUrl = jest.fn();

      // OPERATE
      await service.createConnectionUrl();

      // CHECK
      expect(service.getRStudioUrl).not.toHaveBeenCalled();
    });
  });
});
