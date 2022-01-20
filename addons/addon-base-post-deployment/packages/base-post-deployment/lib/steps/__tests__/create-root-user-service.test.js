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

jest.mock('@aws-ee/base-services/lib/db-password/db-password-service');
const DbPasswordServiceMock = require('@aws-ee/base-services/lib/db-password/db-password-service');

jest.mock('@aws-ee/base-services/lib/user/user-service');
const UserServiceMock = require('@aws-ee/base-services/lib/user/user-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

const CreateRootUserService = require('../create-root-user-service');

describe('CreateRootUserService', () => {
  let service;
  let settings;
  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('settings', new SettingsServiceMock());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbPasswordService', new DbPasswordServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('createRootUserService', new CreateRootUserService());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('createRootUserService');

    // Mock return for settings get
    settings = await container.find('settings');
  });

  beforeEach(async () => {
    const aws = await service.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('createNativeAdminUser', () => {
    it('should attempt to store password if native pool admin existed but password did not', async () => {
      // BUILD
      const userPoolName = 'envName-solutionName-userPool';
      AWSMock.mock('CognitoIdentityServiceProvider', 'listUserPools', (_, callback) => {
        callback(null, { UserPools: [{ Name: userPoolName, Id: 'sampleUserPoolId' }] });
      });
      AWSMock.mock('CognitoIdentityServiceProvider', 'adminGetUser', (_, callback) => {
        // Method does not fail which means user exists in cognito
        callback(null, {});
      });

      settings.get = jest.fn(key => {
        return key;
      });
      settings.getBoolean = jest.fn(key => {
        if (key === 'enableNativeUserPoolUsers') {
          return true;
        }
        return key;
      });
      // user already exists in SWB DDB
      service.createUser = jest.fn(() => {
        // eslint-disable-next-line no-throw-literal
        throw { code: 'alreadyExists' };
      });
      // Password doesn't exist in SSM
      service.getSsmParam = jest.fn(() => {
        // eslint-disable-next-line no-throw-literal
        throw { code: 'ParameterNotFound' };
      });
      service.putSsmParam = jest.fn();

      // OPERATE
      await service.createNativeAdminUser();

      // CHECK
      expect(service.putSsmParam).toHaveBeenCalled();
    });

    it('should create first admin in native user pool with password stored in SSM', async () => {
      // BUILD
      const userPoolName = 'envName-solutionName-userPool';
      AWSMock.mock('CognitoIdentityServiceProvider', 'listUserPools', (_, callback) => {
        callback(null, { UserPools: [{ Name: userPoolName, Id: 'sampleUserPoolId' }] });
      });
      AWSMock.mock('CognitoIdentityServiceProvider', 'adminGetUser', () => {
        // eslint-disable-next-line no-throw-literal
        throw { code: 'UserNotFoundException' };
      });
      AWSMock.mock('CognitoIdentityServiceProvider', 'adminCreateUser', (params, callback) => {
        expect(params).toMatchObject({
          TemporaryPassword: 'nativeAdminPassword',
          UserAttributes: [
            {
              Name: 'family_name',
              Value: 'rootUserLastName',
            },
            {
              Name: 'name',
              Value: 'rootUserFirstName',
            },
            {
              Name: 'given_name',
              Value: 'rootUserFirstName',
            },
            // These two attributes help users leverage Cognito native user pool's Forgot Password feature
            {
              Name: 'email',
              Value: 'rootUserEmail',
            },
            {
              Name: 'email_verified',
              Value: 'true',
            },
          ],
          Username: 'rootUserEmail',
          UserPoolId: 'sampleUserPoolId',
        });
        callback(null, {});
      });
      service.generatePassword = jest.fn(() => {
        return 'nativeAdminPassword';
      });
      settings.get = jest.fn(key => {
        return key;
      });
      settings.getBoolean = jest.fn(key => {
        if (key === 'enableNativeUserPoolUsers') {
          return true;
        }
        return key;
      });
      // user exists in SWB DDB
      service.createUser = jest.fn();
      // Password already exists in SSM
      service.getSsmParam = jest.fn(() => {
        // eslint-disable-next-line no-throw-literal
        throw { code: 'ParameterNotFound' };
      });
      service.putSsmParam = jest.fn();

      // OPERATE
      await service.createNativeAdminUser();

      // CHECK
      expect(service.putSsmParam).toHaveBeenCalled();
    });
  });
});
