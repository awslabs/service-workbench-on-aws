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
jest.mock('@aws-ee/base-services/lib/logger/logger-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryService = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-connection-service');
const EnvironmentScConnectionServiceMock = require('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-connection-service');

jest.mock('../../appstream/appstream-sc-service');
const AppStreamScService = require('../../appstream/appstream-sc-service');

const plugin = require('../env-sc-connection-url-plugin');

// Tested Functions: createConnectionUrl
describe('envScConnectionUrlPlugin', () => {
  let container;
  let appStreamScService;
  let settings;
  let environmentScConnectionService;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('appStreamScService', new AppStreamScService());
    container.register('settings', new SettingsServiceMock());
    container.register('log', new Logger());
    container.register('environmentScConnectionService', new EnvironmentScConnectionServiceMock());

    await container.initServices();
    settings = await container.find('settings');
    appStreamScService = await container.find('appStreamScService');
    environmentScConnectionService = await container.find('environmentScConnectionService');
  });

  describe('createConnectionUrl', () => {
    const requestContext = { principalIdentifier: { uid: 'u-testuser' } };
    it('should return original connection info if AppStream is disabled', async () => {
      // BUILD
      const connection = { scheme: 'http', operation: 'create' };
      const envId = 'sampleEnvId';
      settings.getBoolean = jest.fn(() => {
        return false;
      });

      // OPERATE
      const retVal = await plugin.createConnectionUrl({ envId, connection }, { requestContext, container });

      // CHECK
      expect(retVal).toEqual({ envId, connection });
    });

    it('should return original connection info if list operation calls plugin', async () => {
      // BUILD
      const connection = { scheme: 'http', operation: 'list' };
      const envId = 'sampleEnvId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });

      // OPERATE
      const retVal = await plugin.createConnectionUrl({ envId, connection }, { requestContext, container });

      // CHECK
      expect(retVal).toEqual({ envId, connection });
    });

    it('should return original connection info if connection scheme is unknown', async () => {
      // BUILD
      const connection = { scheme: 'random', operation: 'create' };
      const envId = 'sampleEnvId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      appStreamScService.getStreamingUrl = jest.fn();
      appStreamScService.urlForRemoteDesktop = jest.fn();

      // OPERATE
      const retVal = await plugin.createConnectionUrl({ envId, connection }, { requestContext, container });

      // CHECK
      expect(retVal).toEqual({ envId, connection });
      expect(appStreamScService.getStreamingUrl).toHaveBeenCalledTimes(0);
      expect(appStreamScService.urlForRemoteDesktop).toHaveBeenCalledTimes(0);
    });

    it('should return AppStream URL with private SageMaker URL when connection type is SageMaker', async () => {
      // BUILD
      const destinationUrl = 'originalPublicDestinationUrl';
      let connection = { scheme: 'http', operation: 'create', url: destinationUrl, type: 'SageMaker' };
      const envId = 'sampleEnvId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      environmentScConnectionService.createPrivateSageMakerUrl = jest.fn(() => {
        return 'newPrivateUrl';
      });
      const streamingUrl = 'sampleAppStreamUrl';
      appStreamScService.getStreamingUrl = jest.fn(() => {
        return streamingUrl;
      });

      // OPERATE
      const retVal = await plugin.createConnectionUrl({ envId, connection }, { requestContext, container });

      connection = {
        scheme: 'http',
        operation: 'create',
        url: streamingUrl,
        type: 'SageMaker',
        appstreamDestinationUrl: 'newPrivateUrl',
      };

      // CHECK
      expect(retVal).toStrictEqual({ envId, connection });
      expect(environmentScConnectionService.createPrivateSageMakerUrl).toHaveBeenCalledTimes(1);
      expect(environmentScConnectionService.createPrivateSageMakerUrl).toHaveBeenCalledWith(
        requestContext,
        envId,
        connection,
      );
      expect(appStreamScService.getStreamingUrl).toHaveBeenCalledTimes(1);
      expect(appStreamScService.getStreamingUrl).toHaveBeenCalledWith(requestContext, {
        environmentId: envId,
        applicationId: 'Firefox',
      });
    });

    it('should return AppStream URL with connection info for HTTP create', async () => {
      // BUILD
      const destinationUrl = 'destinationUrl';
      let connection = { scheme: 'http', operation: 'create', url: destinationUrl };
      const envId = 'sampleEnvId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      const streamingUrl = 'sampleAppStreamUrl';
      appStreamScService.getStreamingUrl = jest.fn(() => {
        return streamingUrl;
      });

      // OPERATE
      const retVal = await plugin.createConnectionUrl({ envId, connection }, { requestContext, container });

      connection = {
        scheme: 'http',
        operation: 'create',
        url: streamingUrl,
        appstreamDestinationUrl: destinationUrl,
      };

      // CHECK
      expect(retVal).toStrictEqual({ envId, connection });
      expect(environmentScConnectionService.createPrivateSageMakerUrl).not.toHaveBeenCalled();
      expect(appStreamScService.getStreamingUrl).toHaveBeenCalledTimes(1);
      expect(appStreamScService.getStreamingUrl).toHaveBeenCalledWith(requestContext, {
        environmentId: envId,
        applicationId: 'Firefox',
      });
    });

    it('should return AppStream URL with connection info for SSH create', async () => {
      // BUILD
      const destinationUrl = 'destinationUrl';
      let connection = { scheme: 'ssh', operation: 'create', url: destinationUrl };
      const envId = 'sampleEnvId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      const streamingUrl = 'sampleAppStreamUrl';
      appStreamScService.getStreamingUrl = jest.fn(() => {
        return streamingUrl;
      });

      // OPERATE
      const retVal = await plugin.createConnectionUrl({ envId, connection }, { requestContext, container });

      connection = {
        scheme: 'ssh',
        operation: 'create',
        url: streamingUrl,
        appstreamDestinationUrl: destinationUrl,
      };

      // CHECK
      expect(retVal).toStrictEqual({ envId, connection });
      expect(appStreamScService.getStreamingUrl).toHaveBeenCalledTimes(1);
      expect(appStreamScService.getStreamingUrl).toHaveBeenCalledWith(requestContext, {
        environmentId: envId,
        applicationId: 'EC2Linux',
      });
    });

    it('should return AppStream URL with connection info for RDP create', async () => {
      // BUILD
      let connection = { scheme: 'rdp', operation: 'create', instanceId: 'sampleInstanceId' };
      const envId = 'sampleEnvId';
      settings.getBoolean = jest.fn(() => {
        return true;
      });
      const streamingUrl = 'sampleAppStreamUrl';
      appStreamScService.urlForRemoteDesktop = jest.fn(() => {
        return streamingUrl;
      });

      // OPERATE
      const retVal = await plugin.createConnectionUrl({ envId, connection }, { requestContext, container });

      connection = {
        scheme: 'rdp',
        operation: 'create',
        url: streamingUrl,
        appstreamDestinationUrl: undefined,
        instanceId: 'sampleInstanceId',
      };

      // CHECK
      expect(retVal).toStrictEqual({ envId, connection });
      expect(appStreamScService.urlForRemoteDesktop).toHaveBeenCalledTimes(1);
      expect(appStreamScService.urlForRemoteDesktop).toHaveBeenCalledWith(requestContext, {
        environmentId: envId,
        instanceId: connection.instanceId,
      });
    });
  });
});
