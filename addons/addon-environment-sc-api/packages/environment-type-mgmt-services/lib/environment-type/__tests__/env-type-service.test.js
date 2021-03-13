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
const _ = require('lodash');

// mocked dependencies
jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

const envTypeStatusEnum = require('../helpers/env-type-status-enum');
const EnvTypeService = require('../env-type-service');

describe('EnvTypeService', () => {
  let service = null;
  let dbService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    // initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('authorizationService', new AuthServiceMock());
    container.register('aws', new AwsMock());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('envTypeService', new EnvTypeService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('envTypeService');
    dbService = await container.find('dbService');

    // skip authorization
    service.assertAuthorized = jest.fn();
    service.isAuthorized = jest.fn();
  });

  describe('list function', () => {
    it('should fail because of an invalid filter', async () => {
      // BUILD
      const ipt = {
        fields: [],
        filter: {
          status: ['gobbledy-gook'],
        },
      };

      // OPERATE
      try {
        await service.list({}, ipt);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toBe(
          `Invalid status specified for filter. Valid values for status are ${_.join(
            envTypeStatusEnum.getValidStatuses(),
          )}`,
        );
      }
    });

    it('should return the envType according to the filter', async () => {
      // BUILD
      const ipt = {
        fields: [],
        filter: {
          status: [envTypeStatusEnum.approved],
        },
      };
      const envType0 = {
        status: envTypeStatusEnum.approved,
      };
      const envType1 = {
        status: envTypeStatusEnum.notApproved,
      };

      dbService.table.scan.mockResolvedValueOnce([envType0, envType1]);

      // OPERATE
      const res = await service.list({}, ipt);

      // CHECK
      expect(res.length).toBe(1);
      expect(res[0]).toBe(envType0);
    });

    it('should return all envTypes', async () => {
      // BUILD
      const ipt = {
        fields: [],
        filter: {
          status: ['*'],
        },
      };
      const envType0 = {
        status: envTypeStatusEnum.approved,
      };
      const envType1 = {
        status: envTypeStatusEnum.notApproved,
      };
      service.isAuthorized.mockResolvedValueOnce(true);
      dbService.table.scan.mockResolvedValueOnce([envType0, envType1]);

      // OPERATE
      const res = await service.list({}, ipt);

      // CHECK
      expect(res.length).toBe(2);
      expect(res[0]).toBe(envType0);
      expect(res[1]).toBe(envType1);
    });
  });

  describe('update function', () => {
    it('should fail because the envType is missing a value for rev', async () => {
      // BUILD
      const envType = {
        id: 'something-fun',
      };

      // OPERATE
      try {
        await service.update({}, envType);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toBe('Input has validation errors');
      }
    });

    it('should fail because the envType does not exist', async () => {
      // BUILD
      const envType = {
        id: 'something-fun',
        rev: 1,
      };
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.update({}, envType);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'notFound')).toBe(true);
        expect(err.message).toBe(`environmentType with id "${envType.id}" does not exist`);
      }
    });

    it('should fail because the envType was just updated', async () => {
      // BUILD
      const envType = {
        id: 'something-fun',
        rev: 2,
        status: envTypeStatusEnum.approved,
      };

      const requestContext = {
        id: envType.id,
        updatedBy: {
          username: 'me',
          ns: 'myself.i',
        },
      };
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      service._fromDbToDataObject = jest.fn().mockResolvedValueOnce(requestContext);

      // OPERATE
      try {
        await service.update(requestContext, envType);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toBe(
          `environmentType information changed just before your request is processed, please try again`,
        );
      }
    });

    it('should fail id incorrect', async () => {
      // BUILD
      const envType = {
        id: '<theverybest>',
        rev: 1,
        name: 'stuff',
        desc: 'stuff',
        status: 'approved',
      };

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      // OPERATE and CHECK
      await expect(service.update(requestContext, envType)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail name incorrect', async () => {
      // BUILD
      const envType = {
        id: 'theverybest',
        rev: 1,
        name: '<stuff>',
        desc: 'stuff',
        status: 'approved',
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      // OPERATE and CHECK
      await expect(service.update(requestContext, envType)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail desc incorrect', async () => {
      // BUILD
      const envType = {
        id: 'theverybest',
        rev: 1,
        name: 'stuff',
        desc: '<stuff>',
        status: 'approved',
      };

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      // OPERATE and CHECK
      await expect(service.update(requestContext, envType)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should succeed to update', async () => {
      // BUILD
      const envType = {
        id: 'theverybest',
        rev: 1,
        name: 'stuff',
        desc: 'stuff',
        status: 'approved',
      };
      service.audit = jest.fn();

      // OPERATE
      await service.update({}, envType);

      // CHECK
      expect(dbService.table.item).toHaveBeenCalledWith(expect.objectContaining({ id: envType.id }));
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, expect.objectContaining({ action: 'update-environment-type' }));
    });
  });

  describe('delete function', () => {
    it('should fail because the envType does not exist', async () => {
      // BUILD
      const envToDelete = {
        id: 'likenooneverwas',
      };
      dbService.table.delete.mockImplementationOnce(() => {
        throw error;
      });
      // OPERATE
      try {
        await service.delete({}, envToDelete);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'notFound')).toBe(true);
        expect(err.message).toBe(`environmentType with id "${envToDelete.id}" does not exist`);
      }
    });

    it('should succeed to delete', async () => {
      // BUILD
      const envToDelete = {
        id: 'tocatchthemismyrealtest',
      };
      service.audit = jest.fn();

      // OPERATE
      await service.delete({}, envToDelete);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith(expect.objectContaining({ id: envToDelete.id }));
      expect(dbService.table.delete).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith({}, expect.objectContaining({ action: 'delete-environment-type' }));
    });
  });

  describe('create function', () => {
    it('should fail because the envType is missing a product', async () => {
      // BUILD
      const envType = {
        id: 'totrainthemismycause',
        name: 'itsyouandme',
        provisioningArtifact: {
          id: 'iknowitsmydestiny',
        },
      };

      // OPERATE
      try {
        await service.create({}, envType);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toBe('Input has validation errors');
      }
    });

    it('should fail because the envType already exists', async () => {
      // BUILD
      const envType = {
        id: 'everychallengealongtheway',
        name: 'withcourageIwillface',
        product: {
          productId: 'iwillbattleeveryday',
        },
        provisioningArtifact: {
          id: 'toclaimmyrightfulplace',
        },
      };

      const requestContext = {
        principalIdentifier: {
          id: 'youremybestfriend',
          ns: 'inaworldwemustdefend',
        },
      };

      service.audit = jest.fn();
      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });
      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      // OPERATE
      try {
        await service.create(requestContext, envType);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toBe(`Workspace type with id "${envType.id}" already exists`);
      }
    });

    it('should successfully create the envType', async () => {
      // BUILD
      const envType = {
        id: 'iwilltravelacrosstheland',
        name: 'searchingfarandwide',
        product: {
          productId: 'each-------tounderstand',
        },
        provisioningArtifact: {
          id: 'thepowerthatsinside',
        },
      };

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      // OPERATE
      await service.create(requestContext, envType);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: envType.id });
      expect(dbService.table.update).toHaveBeenCalled();
      expect(service.audit).toHaveBeenCalledWith(
        requestContext,
        expect.objectContaining({ action: 'create-environment-type' }),
      );
    });

    it('should fail id incorrect', async () => {
      // BUILD
      const envType = {
        id: '<script>',
        name: 'searchingfarandwide',
        product: {
          productId: 'each-------tounderstand',
        },
        provisioningArtifact: {
          id: 'thepowerthatsinside',
        },
      };

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      // OPERATE and CHECK
      await expect(service.create(requestContext, envType)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail name incorrect', async () => {
      // BUILD
      const envType = {
        id: 'id',
        name: '<script>',
        product: {
          productId: 'each-------tounderstand',
        },
        provisioningArtifact: {
          id: 'thepowerthatsinside',
        },
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      // OPERATE and CHECK
      await expect(service.create(requestContext, envType)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });

    it('should fail productId incorrect', async () => {
      // BUILD
      const envType = {
        id: 'id',
        name: 'name',
        product: {
          productId: '<script>',
        },
        provisioningArtifact: {
          id: 'thepowerthatsinside',
        },
      };

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      // OPERATE and CHECK
      await expect(service.create(requestContext, envType)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
    it('should fail provisioningArtifactId incorrect', async () => {
      // BUILD
      const envType = {
        id: 'id',
        name: 'name',
        product: {
          productId: 'id',
        },
        provisioningArtifact: {
          id: '<script>',
        },
      };

      const requestContext = {
        principalIdentifier: {
          id: 'aheartsotrue',
          ns: 'ourcouragewillpullusthrough',
        },
      };

      service.audit = jest.fn();

      // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
      service.getProvisioningArtifactParams = jest.fn();

      // OPERATE and CHECK
      await expect(service.create(requestContext, envType)).rejects.toThrow(
        expect.objectContaining({ boom: true, code: 'badRequest', safe: true, message: 'Input has validation errors' }),
      );
    });
  });
});
