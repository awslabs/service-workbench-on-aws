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
  createDefaultServiceCatalogProduct,
  deleteDefaultServiceCatalogProduct,
  addProductInfo,
} = require('../../../support/complex/default-integration-test-product');
const errorCode = require('../../../support/utils/error-code');

describe('Delete workspace-type scenarios', () => {
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

  describe('Delete workspace-type', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

      await adminSession2.resources.users.deactivateUser(adminSession2.user);

      await expect(
        adminSession2.resources.workspaceTypes.workspaceType(workspaceTypeId).delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });

      await expect(adminSession.resources.workspaceTypes.workspaceType(workspaceTypeId).get()).resolves.toHaveProperty(
        'id',
        workspaceTypeId,
      );
    });

    it('should fail if user is not admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

      await expect(
        researcherSession.resources.workspaceTypes.workspaceType(workspaceTypeId).delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      await expect(adminSession.resources.workspaceTypes.workspaceType(workspaceTypeId).get()).resolves.toHaveProperty(
        'id',
        workspaceTypeId,
      );
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

      await expect(
        anonymousSession.resources.workspaceTypes.workspaceType(workspaceTypeId).delete(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });

      await expect(adminSession.resources.workspaceTypes.workspaceType(workspaceTypeId).get()).resolves.toHaveProperty(
        'id',
        workspaceTypeId,
      );
    });

    it('should delete if user is admin', async () => {
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

      await expect(
        adminSession.resources.workspaceTypes.workspaceType(workspaceTypeId).delete(),
      ).resolves.toMatchObject({});

      await expect(adminSession.resources.workspaceTypes.workspaceType(workspaceTypeId).get()).rejects.toMatchObject({
        code: errorCode.http.code.notFound,
      });
    });
  });
});
