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

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');

jest.mock('@aws-ee/base-raas-services/lib/indexes/indexes-service');
const IndexesServiceMock = require('@aws-ee/base-raas-services/lib/indexes/indexes-service');

const plugin = require('../aws-account-mgmt-plugin');

// CHECKed Functions: getActiveNonAppStreamEnvs
describe('awsAccountMgmtPlugin', () => {
  let container;
  let settings;
  let environmentScService;
  let indexesService;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('settings', new SettingsServiceMock());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('indexesService', new IndexesServiceMock());

    await container.initServices();
    settings = await container.find('settings');
    environmentScService = await container.find('environmentScService');
    indexesService = await container.find('indexesService');
  });

  describe('getActiveNonAppStreamEnvs', () => {
    const requestContext = { principalIdentifier: { uid: 'u-testuser' } };
    it('should return empty list if AppStream is disabled', async () => {
      // BUILD
      const awsAccountId = 'sampleAwsAccountId';
      settings.getBoolean = jest.fn(() => {
        return false;
      });
      const expected = [];

      // OPERATE
      const retVal = await plugin.getActiveNonAppStreamEnvs({ awsAccountId, requestContext, container });

      // CHECK
      expect(retVal).toEqual(expected);
    });

    it('should return a list of active non-AppStream environments for an account if AppStream is enabled', async () => {
      // BUILD
      const awsAccountId = 'sampleAwsAccountId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      const scEnvs = [
        { id: 'env1', indexId: 'index1', isAppStreamConfigured: true, status: 'COMPLETED' },
        { id: 'env2', indexId: 'index1', isAppStreamConfigured: false, status: 'COMPLETED' }, // This will be returned
        { id: 'env3', indexId: 'index1', isAppStreamConfigured: false, status: 'FAILED' },
        { id: 'env4', indexId: 'index1', isAppStreamConfigured: false, status: 'TERMINATED' },
        { id: 'env5', indexId: 'index1', isAppStreamConfigured: false, status: 'UNKNOWN' },
      ];
      const indexes = [
        { id: 'index1', awsAccountId },
        { id: 'index2', awsAccountId: 'someOtherAccount' },
      ];
      environmentScService.list = jest.fn(() => {
        return scEnvs;
      });
      indexesService.list = jest.fn(() => {
        return indexes;
      });

      const expected = ['env2'];

      // OPERATE
      const retVal = await plugin.getActiveNonAppStreamEnvs({ awsAccountId, requestContext, container });

      // CHECK
      expect(retVal).toEqual(expected);
    });

    it('should return an empty list if no active non-AppStream environments for an account are found', async () => {
      // BUILD
      const awsAccountId = 'sampleAwsAccountId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      const scEnvs = [
        { id: 'env1', indexId: 'index1', isAppStreamConfigured: true, status: 'COMPLETED' },
        { id: 'env2', indexId: 'index1', isAppStreamConfigured: false, status: 'TERMINATED' },
        { id: 'env3', indexId: 'index1', isAppStreamConfigured: false, status: 'FAILED' },
        { id: 'env4', indexId: 'index1', isAppStreamConfigured: false, status: 'UNKNOWN' },
      ];
      const indexes = [
        { id: 'index1', awsAccountId },
        { id: 'index2', awsAccountId: 'someOtherAccount' },
      ];
      environmentScService.list = jest.fn(() => {
        return scEnvs;
      });
      indexesService.list = jest.fn(() => {
        return indexes;
      });

      const expected = [];

      // OPERATE
      const retVal = await plugin.getActiveNonAppStreamEnvs({ awsAccountId, requestContext, container });

      // CHECK
      expect(retVal).toEqual(expected);
    });

    it('should return an empty list if active non-AppStream environments exist but for a different account', async () => {
      // BUILD
      const awsAccountId = 'sampleAwsAccountId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      const scEnvs = [
        { id: 'env1', indexId: 'index1', isAppStreamConfigured: true, status: 'COMPLETED' },
        { id: 'env2', indexId: 'index1', isAppStreamConfigured: false, status: 'STOPPED' },
      ];
      const indexes = [
        { id: 'index1', awsAccountId: 'someOtherAccount' },
        { id: 'index2', awsAccountId },
      ];
      environmentScService.list = jest.fn(() => {
        return scEnvs;
      });
      indexesService.list = jest.fn(() => {
        return indexes;
      });

      const expected = [];

      // OPERATE
      const retVal = await plugin.getActiveNonAppStreamEnvs({ awsAccountId, requestContext, container });

      // CHECK
      expect(retVal).toEqual(expected);
    });
  });
});
