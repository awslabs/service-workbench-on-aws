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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');
const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const AWSMock = require('aws-sdk-mock');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/user/user-service');
const UserServiceMock = require('@aws-ee/base-services/lib/user/user-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../user-attributes-mapper-service');
const UserAttributesMapperServiceMock = require('../user-attributes-mapper-service');

jest.mock('../../../../token-revocation-service');
const TokenRevocationServiceMock = require('../../../../token-revocation-service');

const ProviderService = require('../provider-service');

describe('ProviderService', () => {
  let service;
  let userAttributesMapperService;
  let userService;
  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('aws', new Aws());
    container.register('log', new Logger());
    container.register('settings', new SettingsServiceMock());
    container.register('userAttributesMapperService', new UserAttributesMapperServiceMock());
    container.register('tokenRevocationService', new TokenRevocationServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('providerService', new ProviderService());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('providerService');

    // Mock return for settings get
    const settings = await container.find('settings');
    settings.get = jest.fn(input => input);

    userAttributesMapperService = await container.find('userAttributesMapperService');
    userService = await container.find('userService');
  });

  beforeEach(async () => {
    const aws = await service.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('syncNativeEmailWithUsername', () => {
    it('should add email attribute if not present', async () => {
      // BUILD
      const userPoolId = 'swb-is-fun';
      const username = 'sampleUsername';
      const authProviderId = `https://cognito-idp.someregion.amazonaws.com/${userPoolId}`;
      AWSMock.mock('CognitoIdentityServiceProvider', 'adminGetUser', (params, callback) => {
        expect(params).toMatchObject({ UserPoolId: userPoolId, Username: username });
        callback(null, { UserAttributes: [] });
      });
      AWSMock.mock('CognitoIdentityServiceProvider', 'adminUpdateUserAttributes', (params, callback) => {
        expect(params).toMatchObject({
          UserAttributes: [
            {
              Name: 'email',
              Value: username,
            },
            {
              Name: 'email_verified',
              Value: 'true',
            },
          ],
          UserPoolId: userPoolId,
          Username: username,
        });
        callback(null, {});
      });

      // OPERATE
      await service.syncNativeEmailWithUsername(username, authProviderId);
    });

    it('should not add email attribute if present', async () => {
      // BUILD
      const userPoolId = 'swb-is-fun';
      const username = 'sampleUsername';
      const authProviderId = `https://cognito-idp.someregion.amazonaws.com/${userPoolId}`;
      // No need to mock and expect adminUpdateUserAttributes params since that won't be called
      AWSMock.mock('CognitoIdentityServiceProvider', 'adminGetUser', (params, callback) => {
        expect(params).toMatchObject({ UserPoolId: userPoolId, Username: username });
        callback(null, {
          UserAttributes: [
            {
              Name: 'email',
              Value: username,
            },
          ],
        });
      });

      // OPERATE
      await service.syncNativeEmailWithUsername(username, authProviderId);
    });
  });

  describe('updateUser', () => {
    it('should update existing user with missing attribute mappings', async () => {
      // BUILD
      userService.updateUser = jest.fn();
      const systemContext = getSystemRequestContext();
      const username = 'test@example.com';
      const userAttributes = {
        username,
        usernameInIdp: username,
        identityProviderName: 'Cognito Native Pool',
        isSamlAuthenticatedUser: false,
        isNativePoolUser: true,
        firstName: 'John',
        lastName: 'Doe',
        email: 'test@example.com',
      };
      const existingUser = {
        identityProviderName: 'Cognito Native Pool',
        uid: 'sample-user-uid',
        username,
        isNativePoolUser: true,
        usernameInIdp: username,
        email: username,
        rev: 2,
      };
      const expected = {
        firstName: 'John',
        lastName: 'Doe',
        isSamlAuthenticatedUser: false,
        rev: 2,
        uid: 'sample-user-uid',
      };

      // OPERATE
      await service.updateUser(userAttributes, existingUser);

      // CHECK
      expect(userService.updateUser).toHaveBeenCalled();
      expect(userService.updateUser).toHaveBeenCalledWith(systemContext, expected);
    });

    it('should update existing user with updated names in attribute mappings', async () => {
      // BUILD
      userService.updateUser = jest.fn();
      const systemContext = getSystemRequestContext();
      const username = 'test@example.com';
      const userAttributes = {
        username,
        usernameInIdp: username,
        identityProviderName: 'Cognito Native Pool',
        isSamlAuthenticatedUser: false,
        isNativePoolUser: true,
        firstName: 'Jen@example.com',
        lastName: 'Doe',
        email: 'test@example.com',
      };
      const existingUser = {
        identityProviderName: 'Cognito Native Pool',
        uid: 'sample-user-uid',
        username,
        firstName: 'newUser',
        lastName: 'Ms. Doe',
        isNativePoolUser: true,
        isSamlAuthenticatedUser: false,
        usernameInIdp: username,
        email: username,
        rev: 2,
      };
      const expected = {
        firstName: 'Jen',
        lastName: 'Doe',
        rev: 2,
        uid: 'sample-user-uid',
      };

      // OPERATE
      await service.updateUser(userAttributes, existingUser);

      // CHECK
      expect(userService.updateUser).toHaveBeenCalled();
      expect(userService.updateUser).toHaveBeenCalledWith(systemContext, expected);
    });

    it('should update sample user created via SWB UI with updated names in attribute mappings', async () => {
      // BUILD
      userService.updateUser = jest.fn();
      const systemContext = getSystemRequestContext();
      const username = 'test@example.com';
      const userAttributes = {
        username,
        usernameInIdp: username,
        identityProviderName: 'Cognito Native Pool',
        isSamlAuthenticatedUser: false,
        isNativePoolUser: true,
        firstName: 'Jen',
        lastName: 'Doe',
        email: 'jen+doe@example.com',
      };
      const existingUser = {
        identityProviderName: 'Cognito Native Pool',
        uid: 'sample-user-uid',
        username,
        firstName: 'jen+doe',
        lastName: 'jen+doe',
        isNativePoolUser: true,
        isSamlAuthenticatedUser: false,
        usernameInIdp: username,
        email: username,
        rev: 2,
      };
      const expected = { firstName: 'Jen', lastName: 'Doe', rev: 2, uid: 'sample-user-uid' };

      // OPERATE
      await service.updateUser(userAttributes, existingUser);

      // CHECK
      expect(userService.updateUser).toHaveBeenCalled();
      expect(userService.updateUser).toHaveBeenCalledWith(systemContext, expected);
    });

    it('should not update existing user if values in sync with attribute mappings', async () => {
      // BUILD
      userService.updateUser = jest.fn();
      const username = 'test@example.com';
      const userAttributes = {
        username,
        usernameInIdp: username,
        identityProviderName: 'Cognito Native Pool',
        isSamlAuthenticatedUser: false,
        isNativePoolUser: true,
        firstName: 'Jen@example.com',
        lastName: 'Doe',
        email: 'test@example.com',
      };
      const existingUser = {
        identityProviderName: 'Cognito Native Pool',
        uid: 'sample-user-uid',
        username,
        firstName: 'Jen',
        lastName: 'Doe',
        isNativePoolUser: true,
        isSamlAuthenticatedUser: false,
        usernameInIdp: username,
        email: username,
        rev: 2,
      };
      // OPERATE
      await service.updateUser(userAttributes, existingUser);

      // CHECK
      expect(userService.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('saveUser', () => {
    it('should create new native user with expected attribute mappings', async () => {
      // BUILD
      const userPoolId = 'swb-is-fun';
      const username = 'sampleUsername@example.com';
      const authProviderId = `https://cognito-idp.someregion.amazonaws.com/${userPoolId}`;
      service.createUser = jest.fn(() => {
        return { uid: 'sample-user-uid' };
      });
      userAttributesMapperService.mapAttributes = jest.fn(() => {
        return {
          username,
          usernameInIdp: username,
          name: 'Test',
          family_name: 'User',
          isNativePoolUser: true,
          identityProviderName: 'Cognito Native Pool',
        };
      });
      const expected = {
        family_name: 'User',
        identityProviderName: 'Cognito Native Pool',
        name: 'Test',
        uid: 'sample-user-uid',
        username,
        isNativePoolUser: true,
        usernameInIdp: username,
        email: username,
      };
      service.syncNativeEmailWithUsername = jest.fn();
      userService.findUserByPrincipal = jest.fn();

      // OPERATE
      const response = await service.saveUser({}, authProviderId);

      // CHECK
      expect(service.createUser).toHaveBeenCalled();
      expect(service.syncNativeEmailWithUsername).toHaveBeenCalled();
      expect(response).toEqual(expected);
    });

    it('should update native user with expected attribute mappings', async () => {
      // BUILD
      const userPoolId = 'swb-is-fun';
      const username = 'sampleUsername@example.com';
      const authProviderId = `https://cognito-idp.someregion.amazonaws.com/${userPoolId}`;
      service.updateUser = jest.fn(() => {
        return { uid: 'sample-user-uid' };
      });
      userAttributesMapperService.mapAttributes = jest.fn(() => {
        return {
          username,
          usernameInIdp: username,
          name: 'Test',
          family_name: 'User',
          isNativePoolUser: true,
          identityProviderName: 'Cognito Native Pool',
        };
      });
      const expected = {
        family_name: 'User',
        identityProviderName: 'Cognito Native Pool',
        name: 'Test',
        uid: 'sample-user-uid',
        username,
        isNativePoolUser: true,
        usernameInIdp: username,
        email: username,
      };
      service.syncNativeEmailWithUsername = jest.fn();
      userService.findUserByPrincipal = jest.fn(() => {
        return { uid: 'sample-user-uid' };
      });

      // OPERATE
      const response = await service.saveUser({}, authProviderId);

      // CHECK
      expect(service.updateUser).toHaveBeenCalled();
      expect(service.syncNativeEmailWithUsername).toHaveBeenCalled();
      expect(response).toEqual(expected);
    });
  });
});
