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

const { runSetup } = require('../../../../support/setup');
const errorCode = require('../../../../support/utils/error-code');

const {
  createWorkspaceTypeAndConfiguration,
} = require('../../../../support/complex/create-workspace-type-and-configuration');
const {
  createDefaultServiceCatalogProduct,
  deleteDefaultServiceCatalogProduct,
} = require('../../../../support/complex/default-integration-test-product');

describe('Create URL scenarios', () => {
  let setup;
  let adminSession;
  let productInfo;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    productInfo = await createDefaultServiceCatalogProduct(setup);
  });

  afterAll(async () => {
    await deleteDefaultServiceCatalogProduct(setup, productInfo);
    await setup.cleanup();
  });

  describe('Create URL', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );
      const connectionId = setup.gen.string({ prefix: 'workspace-service-catalog-connection-test' });

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await adminSession2.resources.users.deactivateUser(adminSession2.user);

      await expect(
        adminSession2.resources.workspaceServiceCatalogs
          .workspaceServiceCatalog(response.id)
          .connections()
          .connection(connectionId)
          .createUrl(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );
      const connectionId = setup.gen.string({ prefix: 'workspace-service-catalog-connection-test' });

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        anonymousSession.resources.workspaceServiceCatalogs
          .workspaceServiceCatalog(response.id)
          .connections()
          .connection(connectionId)
          .createUrl(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
