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

const { runSetup } = require('../../../support/setup');

const {
  createWorkspaceTypeAndConfiguration,
} = require('../../../support/complex/create-workspace-type-and-configuration');
const {
  createDefaultServiceCatalogProduct,
  deleteDefaultServiceCatalogProduct,
} = require('../../../support/complex/default-integration-test-product');
const errorCode = require('../../../support/utils/error-code');

describe('Delete workspace-service-catalog scenarios', () => {
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

  describe('Delete workspace-service-catalog', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      await adminSession.resources.users.deactivateUser(adminSession2.user);

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        adminSession2.resources.workspaceServiceCatalogs.workspaceServiceCatalog(response.id).delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        anonymousSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(response.id).delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail if user is not owner of workspace', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        researcherSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(response.id).delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should delete if user is admin', async () => {
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        adminSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(response.id).delete(),
      ).resolves.toEqual({});
    });

    it('should delete if user is owner of workspace', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
        ['researcher'],
      );

      const response = await researcherSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        researcherSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(response.id).delete(),
      ).resolves.toEqual({});
    });
  });
});
