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
const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const AWSMock = require('aws-sdk-mock');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/s3-service');
const S3ServiceMock = require('@aws-ee/base-services/lib/s3-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../../../authentication-provider-config-service');
const AuthenticationProviderConfigServiceMock = require('../../../authentication-provider-config-service');

const ProvisionerService = require('../provisioner-service');

describe('ProvisionerService', () => {
  let service;
  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('settings', new SettingsServiceMock());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('authenticationProviderConfigService', new AuthenticationProviderConfigServiceMock());
    container.register('s3Service', new S3ServiceMock());
    container.register('provisionerService', new ProvisionerService());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('provisionerService');

    // Mock return for settings get
    const settings = await container.find('settings');
    settings.get = jest.fn(input => input);
  });

  beforeEach(async () => {
    const aws = await service.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('configureUserPoolDomain', () => {
    const providerConfig = {
      userPoolDomain: 'swb-dev',
      userPoolId: 'some-user-pool-id',
    };
    it('should configure user pool domain with passed in domain', async () => {
      // BUILD
      AWSMock.mock('CognitoIdentityServiceProvider', 'createUserPoolDomain', (params, callback) => {
        expect(params).toMatchObject({ Domain: 'swb-dev', UserPoolId: 'some-user-pool-id' });
        callback(null, {});
      });
      // OPERATE
      await service.configureUserPoolDomain(providerConfig);
    });

    it('should configure user pool domain with default value if domain is not passed in', async () => {
      // BUILD
      AWSMock.mock('CognitoIdentityServiceProvider', 'createUserPoolDomain', (params, callback) => {
        expect(params).toMatchObject({ Domain: 'envName-envType-solutionName', UserPoolId: 'some-user-pool-id' });
        callback(null, {});
      });
      // OPERATE
      await service.configureUserPoolDomain({ userPoolId: 'some-user-pool-id' });
    });

    it('should stop retry when retry count is reached', async () => {
      // BUILD
      AWSMock.mock('CognitoIdentityServiceProvider', 'createUserPoolDomain', (params, callback) => {
        const error = {
          code: 'InvalidParameterException',
          message: 'Domain already associated with another user pool',
        };
        callback(error, {});
      });
      // OPERATE
      try {
        await service.configureUserPoolDomain(providerConfig);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Domain already associated with another user pool');
      }
    });

    it('should not retry if an unrecognized error is thrown', async () => {
      // BUILD
      AWSMock.mock('CognitoIdentityServiceProvider', 'createUserPoolDomain', (params, callback) => {
        const error = {
          code: 'InvalidParameterException',
          message: 'some other validation error',
        };
        callback(error, {});
      });
      service.retryCreateDomain = jest.fn();
      // OPERATE
      try {
        await service.configureUserPoolDomain(providerConfig);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('some other validation error');
        expect(service.retryCreateDomain).not.toHaveBeenCalled();
      }
    });

    it('should retry if "already associated with another user pool" error is thrown', async () => {
      // BUILD
      AWSMock.mock('CognitoIdentityServiceProvider', 'createUserPoolDomain', (params, callback) => {
        const error = {
          code: 'InvalidParameterException',
          message: 'Domain already associated with another user pool',
        };
        callback(error, {});
      });
      service.retryCreateDomain = jest.fn();
      // OPERATE
      await service.configureUserPoolDomain(providerConfig);
      // CHECK
      expect(service.retryCreateDomain).toHaveBeenCalled();
    });
  });
});
