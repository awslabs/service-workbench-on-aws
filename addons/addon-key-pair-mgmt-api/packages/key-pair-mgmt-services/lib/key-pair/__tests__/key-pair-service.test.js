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

const KeyPairService = require('../key-pair-service');

describe('keyPairService', () => {
  let service = null;
  beforeEach(async () => {
    // initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('keyPairService', new KeyPairService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('keyPairService');

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
  });

  //   it('should fail name incorrect', async () => {
  //     // BUILD
  //     const envType = {
  //       id: 'theverybest',
  //       rev: 1,
  //       name: '<stuff>',
  //       desc: 'stuff',
  //       status: 'approved',
  //     };

  //     service.audit = jest.fn();

  //     // This function mainly just wraps some aws functions on a ServiceCatalogClient instance
  //     service.getProvisioningArtifactParams = jest.fn();

  //     const requestContext = {
  //       principalIdentifier: {
  //         id: 'aheartsotrue',
  //         ns: 'ourcouragewillpullusthrough',
  //       },
  //     };

  //     // OPERATE and CHECK
  //     await expect(service.update(requestContext, envType)).rejects.toThrow(
  //       expect.objectContaining({
  //         boom: true,
  //         code: 'badRequest',
  //         safe: true,
  //         message: 'Input has validation errors',
  //       }),
  //     );
  //   });
});
