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

// mocked dependencies
jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/s3-service');
const S3ServiceMock = require('@aws-ee/base-services/lib/s3-service');

jest.mock('../env-type-service');
const EnvTypeServiceMock = require('../env-type-service');

jest.mock('../env-type-config-authz-service');
const EnvTypeConfigAuthzServiceMock = require('../env-type-config-authz-service');

const EnvTypeConfigService = require('../env-type-config-service');

describe('EnvTypeService', () => {
  let service = null;
  let envTypeService = null;
  let s3Service = null;
  beforeEach(async () => {
    // initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('aws', new AwsMock());
    container.register('s3Service', new S3ServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('envTypeService', new EnvTypeServiceMock());
    container.register('envTypeConfigAuthzService', new EnvTypeConfigAuthzServiceMock());
    container.register('envTypeConfigService', new EnvTypeConfigService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('envTypeConfigService');
    envTypeService = await container.find('envTypeService');
    s3Service = await container.find('s3Service');

    // skip authorization
    service.assertAuthorized = jest.fn();
    service.isAuthorized = jest.fn(() => {
      return true;
    });

    // mocking some aws functions
    service.fromRawToS3Object = jest.fn(x => x);
    service.fromS3ToDataObject = jest.fn(x => x);
    service.getS3Coordinates = jest.fn(() => {
      return { bucket: 'bucket', key: 'key' };
    });
    service.getConfigsFromS3 = jest.fn();
    s3Service.api = {
      putObject: jest.fn().mockReturnThis(),
      promise: jest.fn().mockReturnThis(),
    };
  });

  describe('list function', () => {
    it('should list the envTypes available that the user can see', async () => {
      // BUILD
      const configAllowed = {
        id: 'this-config-is-allowed',
      };

      const configNotAllowed = {
        id: 'this-config-is-not-allowed',
      };

      envTypeService.mustFind.mockImplementationOnce(() => {
        return { id: 'random' };
      });

      service.getConfigsFromS3 = jest.fn().mockResolvedValueOnce([configNotAllowed, configAllowed]);

      // don't authorize the first config
      service.isAuthorized.mockImplementationOnce(() => {
        return false;
      });

      // OPERATE
      const res = await service.list({}, {});

      // CHECK
      expect(res.length).toBe(1);
      expect(res[0]).toBe(configAllowed);
    });

    it('should list all envTypes because user is an admin', async () => {
      // BUILD
      const configAllowed = {
        id: 'this-config-is-allowed',
      };

      const configNotAllowed = {
        id: 'this-config-is-not-allowed',
      };

      envTypeService.mustFind.mockImplementationOnce(() => {
        return { id: 'random' };
      });

      service.getConfigsFromS3 = jest.fn().mockResolvedValueOnce([configNotAllowed, configAllowed]);

      // don't authorize the first config (will still be displayed because user is an admin)
      service.isAuthorized.mockImplementationOnce(() => {
        return false;
      });

      // OPERATE
      const res = await service.list({}, {}, true);

      // CHECK
      expect(res.length).toBe(2);
      expect(res[0]).toBe(configNotAllowed);
      expect(res[1]).toBe(configAllowed);
    });
  });

  describe('create function', () => {
    it('should fail because no name was provided', async () => {
      // BUILD
      const newConfig = {
        id: 'iveGotABadFeelingAboutThis',
      };

      // OPERATE
      try {
        await service.create({}, 'envTypeId', newConfig);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toBe('Input has validation errors');
      }
    });

    it('should fail because the config already exists', async () => {
      // BUILD
      const newConfig = {
        id: 'iAmYourFather',
        name: 'dvader',
        params: [],
      };
      const envType = {
        id: newConfig.id,
        name: 'anakin',
        params: [],
      };
      envTypeService.mustFind.mockImplementationOnce(() => envType);
      service.getConfigsFromS3.mockImplementationOnce(() => {
        return [newConfig];
      });

      // OPERATE
      try {
        await service.create({}, newConfig.id, newConfig);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toBe(
          `The environment type configuration with id "${newConfig.id}" for environment type "${newConfig.id}" already exists`,
        );
      }
    });

    it('should fail because the config is missing params', async () => {
      // BUILD
      const newConfig = {
        id: 'iAmYourFather',
        name: 'dvader',
        params: [],
      };
      const envType = {
        id: newConfig.id,
        name: 'anakin',
        params: [
          {
            ParameterKey: 'someProperty',
            ParameterType: 'String',
          },
        ],
      };
      envTypeService.mustFind.mockImplementationOnce(() => envType);

      // OPERATE
      try {
        await service.create({}, newConfig.id, newConfig);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toContain('missing parameter mappings');
      }
    });

    it('should fail desc incorrect', async () => {
      // BUILD
      const newConfig = {
        id: 'iFindYourLackOfFaith',
        name: 'disturbing',
        desc: '<stuff>',
        estimatedCostInfo: 'costs alot',
        allowRoleIds: ['1234'],
        denyRoleIds: ['1234'],
        params: [
          {
            key: 'someProperty',
            value: 'someValue',
          },
        ],
      };

      const envType = {
        id: newConfig.id,
        name: 'anakin',
        params: [
          {
            ParameterKey: 'someProperty',
            ParameterType: 'String',
          },
        ],
      };
      envTypeService.mustFind.mockImplementationOnce(() => envType);
      service.audit = jest.fn();

      // OPERATE and CHECK
      await expect(service.create({}, newConfig.id, newConfig)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail estimatedCostInfo incorrect', async () => {
      // BUILD
      const newConfig = {
        id: 'iFindYourLackOfFaith',
        name: 'disturbing',
        desc: 'stuff',
        estimatedCostInfo: '<costs alot>',
        allowRoleIds: ['1234'],
        denyRoleIds: ['1234'],
        params: [
          {
            key: 'someProperty',
            value: 'someValue',
          },
        ],
      };

      const envType = {
        id: newConfig.id,
        name: 'anakin',
        params: [
          {
            ParameterKey: 'someProperty',
            ParameterType: 'String',
          },
        ],
      };
      envTypeService.mustFind.mockImplementationOnce(() => envType);
      service.audit = jest.fn();

      // OPERATE and CHECK
      await expect(service.create({}, newConfig.id, newConfig)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should succeed to create a config for the envType', async () => {
      // BUILD
      const newConfig = {
        id: 'iFindYourLackOfFaith',
        name: 'disturbing',
        desc: 'stuff',
        estimatedCostInfo: 'costs alot',
        allowRoleIds: ['1234'],
        denyRoleIds: ['1234'],
        params: [
          {
            key: 'vpcId',
            value: '${vpcId}',
          },
        ],
      };
      const envType = {
        id: newConfig.id,
        name: 'anakin',
        params: [
          {
            ParameterKey: 'vpcId',
            ParameterType: 'String',
          },
        ],
      };
      envTypeService.mustFind.mockImplementationOnce(() => envType);
      service.audit = jest.fn();

      // OPERATE
      await service.create({}, envType.id, newConfig);

      // CHECK
      expect(s3Service.api.putObject).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ action: 'create-environment-type-config' }),
      );
    });
  });

  describe('update function', () => {
    // note that the following are identical to the create function (they call the same methods with the same args)
    //    -schema validation (uses same JSON schema)
    //    -CFN template validation
    //    -checking if the config already exists
    // as a result, they don't need to be tested again
    it('should succeed to update the config for the envType', async () => {
      // BUILD
      const oldConfig = {
        id: 'yoda',
        name: 'doOrDoNot',
        params: [
          {
            key: 'someProperty',
            value: 'someValue',
          },
        ],
      };
      const newConfig = {
        id: 'yoda',
        name: 'troubledYouAre',
        params: [
          {
            key: 'someProperty',
            value: 'someNewValue',
          },
        ],
      };
      const envType = {
        id: newConfig.id,
        name: 'luke',
        params: [
          {
            ParameterKey: 'someProperty',
            ParameterType: 'String',
          },
        ],
      };
      envTypeService.mustFind.mockImplementationOnce(() => envType);
      service.getConfigsFromS3.mockImplementationOnce(() => [oldConfig]);
      service.audit = jest.fn();

      // OPERATE
      await service.update({}, envType.id, newConfig);

      // CHECK
      expect(s3Service.api.putObject).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ action: 'update-environment-type-config' }),
      );
    });
  });

  describe('delete function', () => {
    it('should succeed to delete the config for the envType', async () => {
      // BUILD
      const oldConfig = {
        id: 'helpmeobiwankenobi',
        name: 'youremyonlyhope',
        params: [
          {
            key: 'someProperty',
            value: 'someValue',
          },
        ],
      };
      const envType = {
        id: oldConfig.id,
        name: 'leia',
        params: [
          {
            ParameterKey: 'someProperty',
            ParameterType: 'String',
          },
        ],
      };
      envTypeService.mustFind.mockImplementationOnce(() => envType);
      service.getConfigsFromS3.mockImplementationOnce(() => [oldConfig]);
      service.audit = jest.fn();

      // OPERATE
      await service.delete({}, envType.id, oldConfig.id);

      // CHECK
      expect(s3Service.api.putObject).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ action: 'delete-environment-type-config' }),
      );
    });
  });
});
