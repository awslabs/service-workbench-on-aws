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

// Mocked dependencies
jest.mock('@amzn/base-services/lib/logger/logger-service');
const Logger = require('@amzn/base-services/lib/logger/logger-service');

jest.mock('@amzn/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryService = require('@amzn/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('@amzn/base-services/lib/lock/lock-service');
const LockService = require('@amzn/base-services/lib/lock/lock-service');

jest.mock('../../environment/service-catalog/environment-sc-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');
const EnvironmentScService = require('../../environment/service-catalog/environment-sc-service');

jest.mock('../../environment/service-catalog/environment-sc-cidr-service');
const EnvironmentScCidrService = require('../../environment/service-catalog/environment-sc-service');

jest.mock('../../environment/environment-dns-service');
const EnvironmentDNSService = require('../../environment/environment-dns-service');

jest.mock('../../alb/alb-service');
const AlbService = require('../../alb/alb-service');

jest.mock('../../environment/service-catalog/environment-sc-keypair-service');
const EnvironmentSCKeyPairService = require('../../environment/service-catalog/environment-sc-keypair-service');

jest.mock('@amzn/base-services/lib/settings/env-settings-service');

const plugin = require('../env-provisioning-plugin');

// Tested Functions: create, update, delete
describe('envProvisioningPlugin', () => {
  let container;
  const requestContext = { principal: { isAdmin: true, status: 'active' } };
  let environmentScService;
  let environmentScCidrService;
  let pluginRegistryService;
  let environmentDnsService;
  let albService;
  let lockService;
  let settings;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    container.register('environmentScService', new EnvironmentScService());
    container.register('environmentScCidrService', new EnvironmentScCidrService());
    container.register('pluginRegistryService', new PluginRegistryService());
    container.register('environmentDnsService', new EnvironmentDNSService());
    container.register('albService', new AlbService());
    container.register('lockService', new LockService());
    container.register('environmentScKeypairService', new EnvironmentSCKeyPairService());
    container.register('log', new Logger());
    container.register('settings', new SettingsServiceMock());

    await container.initServices();
    settings = await container.find('settings');
    environmentScService = await container.find('environmentScService');
    pluginRegistryService = await container.find('pluginRegistryService');
    environmentDnsService = await container.find('environmentDnsService');
    environmentScCidrService = await container.find('environmentScCidrService');
    albService = await container.find('albService');
    lockService = await container.find('lockService');
    lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());
  });

  describe('preProvisioning', () => {
    it('should invoke kms update for egress store if there is no study to be linked', async () => {
      // BUILD
      environmentScService.mustFind = jest.fn().mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce([]);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({ accountId: '1234567' });
      pluginRegistryService.visitPlugins = jest.fn();

      // OPERATE
      await plugin.onEnvPreProvisioning({ requestContext, container, envId: 'some-env-id' });
      // CHECK
      expect(environmentScService.getMemberAccount).toHaveBeenCalledWith(requestContext, { id: 'env-id' });
    });

    it('visit plugins with correct parameters if there is study to be linked', async () => {
      // BUILD
      environmentScService.mustFind = jest.fn().mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce(['study1', 'study2']);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({ accountId: '1234567' });
      pluginRegistryService.visitPlugins = jest.fn();

      // OPERATE
      await plugin.onEnvPreProvisioning({ requestContext, container, envId: 'some-env-id' });
      // CHECK
      expect(environmentScService.getMemberAccount).toHaveBeenCalledWith(requestContext, { id: 'env-id' });
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalledWith(
        'study-access-strategy',
        'allocateEnvStudyResources',
        {
          payload: expect.objectContaining({
            environmentScEntity: {
              id: 'env-id',
            },
            memberAccountId: '1234567',
            requestContext: {
              principal: {
                isAdmin: true,
                status: 'active',
              },
            },
            studies: ['study1', 'study2'],
          }),
        },
      );
    });
  });

  describe('preProvisioningFailure', () => {
    it('should update environment record and deallocate resources', async () => {
      // BUILD
      environmentScService.mustFind = jest
        .fn()
        .mockResolvedValueOnce({ id: 'env-id' })
        .mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce(['study1', 'study2']);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({ accountId: '1234567' });
      pluginRegistryService.visitPlugins = jest.fn().mockResolvedValueOnce({});
      // OPERATE
      await plugin.onEnvPreProvisioningFailure({
        requestContext,
        container,
        envId: 'env-id',
        status: 'FAILED',
        error: { message: 'Preprovisioning fail message' },
      });
      // CHECK
      expect(environmentScService.getMemberAccount).toHaveBeenCalledWith(requestContext, { id: 'env-id' });
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalledWith(
        'study-access-strategy',
        'deallocateEnvStudyResources',
        {
          payload: expect.objectContaining({
            container,
            environmentScEntity: {
              id: 'env-id',
            },
            memberAccountId: '1234567',
            requestContext: {
              principal: {
                isAdmin: true,
                status: 'active',
              },
            },
            studies: ['study1', 'study2'],
          }),
          continueOnError: true,
        },
      );
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        { error: 'Preprovisioning fail message', id: 'env-id', rev: 0, status: 'FAILED' },
      );
    });

    it('should throw bad request error if plugin throws error', async () => {
      // BUILD
      environmentScService.mustFind = jest
        .fn()
        .mockResolvedValueOnce({ id: 'env-id' })
        .mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce(['study1', 'study2']);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({ accountId: '1234567' });
      pluginRegistryService.visitPlugins = jest.fn().mockResolvedValueOnce({
        pluginErrors: [{ message: 'first-plugin-error' }, { message: 'second-plugin-error' }],
      });
      pluginRegistryService.boom = {
        badRequest: jest.fn().mockImplementationOnce(messages => messages),
      };

      // OPERATE
      try {
        await plugin.onEnvPreProvisioningFailure({
          requestContext,
          container,
          envId: 'env-id',
          status: 'FAILED',
          error: { message: 'Preprovisioning fail message' },
        });
        expect.hasAssertions();
      } catch (err) {
        expect(err).toEqual('first-plugin-error, second-plugin-error');
      }
      // CHECK
      expect(environmentScService.getMemberAccount).toHaveBeenCalledWith(requestContext, { id: 'env-id' });
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalledWith(
        'study-access-strategy',
        'deallocateEnvStudyResources',
        {
          payload: expect.objectContaining({
            container,
            environmentScEntity: {
              id: 'env-id',
            },
            memberAccountId: '1234567',
            requestContext: {
              principal: {
                isAdmin: true,
                status: 'active',
              },
            },
            studies: ['study1', 'study2'],
          }),
          continueOnError: true,
        },
      );
      expect(pluginRegistryService.boom.badRequest).toHaveBeenCalledWith(
        'first-plugin-error, second-plugin-error',
        true,
      );
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        { error: 'Preprovisioning fail message', id: 'env-id', rev: 0, status: 'FAILED' },
      );
    });
  });

  describe('updateEnvOnProvisioningSuccess', () => {
    it('should update environment record with output value', async () => {
      // BUILD
      environmentScService.mustFind = jest.fn().mockResolvedValueOnce({ id: 'env-id' });
      // OPERATE
      await plugin.onEnvProvisioningSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        outputs: [],
        provisionedProductId: 'provisioned-product-id',
      });
      // CHECK
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
          outputs: [],
          provisionedProductId: 'provisioned-product-id',
        },
      );
    });

    it('should create environmentDNS record if it is RStudio environment', async () => {
      // BUILD
      environmentScService.mustFind = jest.fn().mockResolvedValueOnce({ id: 'env-id' });
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return false;
        }
        throw Error(`${key} not found`);
      });
      // OPERATE
      await plugin.onEnvProvisioningSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudio' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
        ],
        provisionedProductId: 'provisioned-product-id',
      });
      // CHECK
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
          outputs: [
            { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudio' },
            { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
          ],
          provisionedProductId: 'provisioned-product-id',
        },
      );
      expect(environmentDnsService.createRecord).toHaveBeenCalledWith('rstudio', 'env-id', 'some-dns-name');
    });

    it('should create environmentDNS record if it is RStudioV2 environment', async () => {
      // BUILD
      environmentScService.mustFind = jest.fn().mockResolvedValueOnce({ id: 'env-id' });
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return false;
        }
        throw Error(`${key} not found`);
      });
      const albDetails = {
        createdAt: '2021-05-21T13:06:58.216Z',
        id: 'test-id',
        type: 'account-workspace-details',
        updatedAt: '2021-05-31T13:32:15.503Z',
        value:
          '{"id":"test-id","albStackName":null,"albArn":"arn:test-arn","listenerArn":"alb-listener-arn","albDnsName":"albDNSName","albDependentWorkspacesCount":1}',
      };
      albService.getAlbDetails = jest.fn(() => {
        return albDetails;
      });
      albService.createListenerRule = jest.fn(() => {
        return 'alb-listener-rule-arn';
      });
      environmentScCidrService.authorizeIngressRuleWithSecurityGroup = jest.fn();
      // OPERATE
      await plugin.onEnvProvisioningSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudioV2' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
          { OutputKey: 'TargetGroupARN', OutputValue: 'some-target-group-arn' },
          { OutputKey: 'InstanceSecurityGroupId', OutputValue: 'some-security-group-id' },
        ],
        provisionedProductId: 'provisioned-product-id',
      });
      // CHECK
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
          outputs: [
            { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudioV2' },
            { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
            { OutputKey: 'TargetGroupARN', OutputValue: 'some-target-group-arn' },
            { OutputKey: 'InstanceSecurityGroupId', OutputValue: 'some-security-group-id' },
            {
              OutputKey: 'ListenerRuleARN',
              Description: 'ARN of the listener rule created by code',
              OutputValue: 'alb-listener-rule-arn',
            },
          ],
          provisionedProductId: 'provisioned-product-id',
        },
      );
      expect(environmentDnsService.createRecord).toHaveBeenCalledWith('rstudio', 'env-id', 'albDNSName');
    });

    it('should create environmentDNS record if it is RStudioV2 AppStream environment', async () => {
      // BUILD
      environmentScService.getMemberAccount = jest
        .fn()
        .mockResolvedValueOnce({ route53HostedZone: 'route53HostedZone' });
      environmentScService.mustFind = jest.fn().mockResolvedValueOnce({ id: 'env-id' });
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return true;
        }
        throw Error(`${key} not found`);
      });
      const albDetails = {
        createdAt: '2021-05-21T13:06:58.216Z',
        id: 'test-id',
        type: 'account-workspace-details',
        updatedAt: '2021-05-31T13:32:15.503Z',
        value:
          '{"id":"test-id","albStackName":null,"albArn":"arn:test-arn","listenerArn":"alb-listener-arn","albDnsName":"albDNSName","albDependentWorkspacesCount":1}',
      };
      albService.getAlbHostedZoneID = jest.fn(() => {
        return 'albHostedZoneId';
      });
      albService.getAlbDetails = jest.fn(() => {
        return albDetails;
      });
      albService.createListenerRule = jest.fn(() => {
        return 'alb-listener-rule-arn';
      });
      environmentScCidrService.authorizeIngressRuleWithSecurityGroup = jest.fn();
      // OPERATE
      await plugin.onEnvProvisioningSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudioV2' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
          { OutputKey: 'TargetGroupARN', OutputValue: 'some-target-group-arn' },
          { OutputKey: 'InstanceSecurityGroupId', OutputValue: 'some-security-group-id' },
        ],
        provisionedProductId: 'provisioned-product-id',
      });
      // CHECK
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
          outputs: [
            { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudioV2' },
            { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
            { OutputKey: 'TargetGroupARN', OutputValue: 'some-target-group-arn' },
            { OutputKey: 'InstanceSecurityGroupId', OutputValue: 'some-security-group-id' },
            {
              OutputKey: 'ListenerRuleARN',
              Description: 'ARN of the listener rule created by code',
              OutputValue: 'alb-listener-rule-arn',
            },
          ],
          provisionedProductId: 'provisioned-product-id',
        },
      );
      expect(environmentDnsService.createPrivateRecordForDNS).toHaveBeenCalledWith(
        requestContext,
        'rstudio',
        'env-id',
        'albHostedZoneId',
        'albDNSName',
        'route53HostedZone',
      );
    });

    it('should create private DNS record if it is RStudio environment when AppStream enabled', async () => {
      // BUILD
      environmentScService.mustFind = jest.fn().mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({ route53HostedZone: 'HOSTEDZONE123' });
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return true;
        }
        throw Error(`${key} not found`);
      });
      // OPERATE
      await plugin.onEnvProvisioningSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudio' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
          { OutputKey: 'Ec2WorkspacePrivateIp', OutputValue: '10.0.0.1' },
        ],
        provisionedProductId: 'provisioned-product-id',
      });
      // CHECK
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
          outputs: [
            { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudio' },
            { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
            { OutputKey: 'Ec2WorkspacePrivateIp', OutputValue: '10.0.0.1' },
          ],
          provisionedProductId: 'provisioned-product-id',
        },
      );
      expect(environmentDnsService.createPrivateRecord).toHaveBeenCalledWith(
        requestContext,
        'rstudio',
        'env-id',
        '10.0.0.1',
        'HOSTEDZONE123',
      );
    });
  });

  describe('updateEnvOnTerminationSuccess', () => {
    it('should update environment record', async () => {
      // BUILD
      environmentScService.mustFind = jest
        .fn()
        .mockResolvedValueOnce({ id: 'env-id' })
        .mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce(['study1', 'study2']);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({
        accountId: '1234567',
      });
      environmentScService.update = jest.fn().mockResolvedValueOnce({
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'SageMaker' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
        ],
      });
      pluginRegistryService.visitPlugins = jest.fn().mockResolvedValueOnce({});

      // OPERATE
      await plugin.onEnvTerminationSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        envId: 'env-id',
        record: {},
      });
      // CHECK
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
        },
        { action: 'REMOVE' },
      );
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalledWith(
        'study-access-strategy',
        'deallocateEnvStudyResources',
        {
          payload: expect.objectContaining({
            container,
            environmentScEntity: {
              id: 'env-id',
            },
            memberAccountId: '1234567',
            requestContext: {
              principal: {
                isAdmin: true,
                status: 'active',
              },
            },
            studies: ['study1', 'study2'],
          }),
          continueOnError: true,
        },
      );
    });

    it('should remove environmentDNS record if it is RStudio environment', async () => {
      // BUILD
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return false;
        }
        throw Error(`${key} not found`);
      });
      environmentScService.mustFind = jest
        .fn()
        .mockResolvedValueOnce({ id: 'env-id' })
        .mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce(['study1', 'study2']);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({
        accountId: '1234567',
      });
      environmentScService.update = jest.fn().mockResolvedValueOnce({
        id: 'env-id',
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudio' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
          { OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: 'some-ec2-instance-id' },
        ],
      });
      pluginRegistryService.visitPlugins = jest.fn().mockResolvedValueOnce({});
      environmentScService.getClientSdkWithEnvMgmtRole = jest.fn().mockResolvedValueOnce({
        deleteParameter: jest.fn().mockReturnThis(),
        promise: jest.fn().mockReturnThis(),
        catch: jest.fn(),
      });

      // OPERATE
      await plugin.onEnvTerminationSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        envId: 'env-id',
        record: {},
      });
      // CHECK
      expect(environmentDnsService.deleteRecord).toHaveBeenCalledWith('rstudio', 'env-id', 'some-dns-name');
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
        },
        { action: 'REMOVE' },
      );
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalledWith(
        'study-access-strategy',
        'deallocateEnvStudyResources',
        {
          payload: expect.objectContaining({
            container,
            environmentScEntity: {
              id: 'env-id',
            },
            memberAccountId: '1234567',
            requestContext: {
              principal: {
                isAdmin: true,
                status: 'active',
              },
            },
            studies: ['study1', 'study2'],
          }),
          continueOnError: true,
        },
      );
    });

    it('should remove private environmentDNS record if it is RStudio environment when AppStream is enabled', async () => {
      // BUILD
      settings.getBoolean = jest.fn(key => {
        if (key === 'isAppStreamEnabled') {
          return true;
        }
        throw Error(`${key} not found`);
      });
      environmentScService.mustFind = jest
        .fn()
        .mockResolvedValueOnce({ id: 'env-id' })
        .mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce(['study1', 'study2']);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValue({
        accountId: '1234567',
        route53HostedZone: 'HOSTEDZONE123',
      });
      environmentScService.update = jest.fn().mockResolvedValueOnce({
        id: 'env-id',
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'RStudio' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
          { OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: 'some-ec2-instance-id' },
          { OutputKey: 'Ec2WorkspacePrivateIp', OutputValue: '10.0.0.1' },
        ],
      });
      pluginRegistryService.visitPlugins = jest.fn().mockResolvedValueOnce({});
      environmentScService.getClientSdkWithEnvMgmtRole = jest.fn().mockResolvedValueOnce({
        deleteParameter: jest.fn().mockReturnThis(),
        promise: jest.fn().mockReturnThis(),
        catch: jest.fn(),
      });

      // OPERATE
      await plugin.onEnvTerminationSuccess({
        requestContext,
        container,
        resolvedVars: { envId: 'env-id' },
        status: 'SUCCEED',
        envId: 'env-id',
        record: {},
      });
      // CHECK
      expect(environmentDnsService.deletePrivateRecord).toHaveBeenCalledWith(
        requestContext,
        'rstudio',
        'env-id',
        '10.0.0.1',
        'HOSTEDZONE123',
      );
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'SUCCEED',
          inWorkflow: 'false',
        },
        { action: 'REMOVE' },
      );
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalledWith(
        'study-access-strategy',
        'deallocateEnvStudyResources',
        {
          payload: expect.objectContaining({
            container,
            environmentScEntity: {
              id: 'env-id',
            },
            memberAccountId: '1234567',
            requestContext: {
              principal: {
                isAdmin: true,
                status: 'active',
              },
            },
            studies: ['study1', 'study2'],
          }),
          continueOnError: true,
        },
      );
    });
  });

  describe('updateEnvOnTerminationFailure', () => {
    it('should update environment record, deallocate resources and clean up keypair', async () => {
      // BUILD
      environmentScService.mustFind = jest
        .fn()
        .mockResolvedValueOnce({ id: 'env-id' })
        .mockResolvedValueOnce({ id: 'env-id' });
      environmentScService.getStudies = jest.fn().mockResolvedValueOnce(['study1', 'study2']);
      environmentScService.getMemberAccount = jest.fn().mockResolvedValueOnce({
        accountId: '1234567',
      });
      environmentScService.update = jest.fn().mockResolvedValueOnce({
        outputs: [
          { OutputKey: 'MetaConnection1Type', OutputValue: 'SageMaker' },
          { OutputKey: 'Ec2WorkspaceDnsName', OutputValue: 'some-dns-name' },
        ],
      });
      pluginRegistryService.visitPlugins = jest.fn().mockResolvedValueOnce({});

      // OPERATE
      await plugin.onEnvTerminationFailure({
        requestContext,
        container,
        status: 'FAILED',
        envId: 'env-id',
        error: { message: 'error in termination' },
        record: {},
      });
      // CHECK
      expect(environmentScService.update).toHaveBeenCalledWith(
        {
          principal: {
            isAdmin: true,
            status: 'active',
          },
        },
        {
          id: 'env-id',
          rev: 0,
          status: 'FAILED',
          error: 'error in termination',
        },
      );
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalledWith(
        'study-access-strategy',
        'deallocateEnvStudyResources',
        {
          payload: expect.objectContaining({
            container,
            environmentScEntity: {
              id: 'env-id',
            },
            memberAccountId: '1234567',
            requestContext: {
              principal: {
                isAdmin: true,
                status: 'active',
              },
            },
            studies: ['study1', 'study2'],
          }),
          continueOnError: true,
        },
      );
    });
  });
});
