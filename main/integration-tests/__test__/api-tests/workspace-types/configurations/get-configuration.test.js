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
  createDefaultServiceCatalogProduct,
  deleteDefaultServiceCatalogProduct,
  addProductInfo,
} = require('../../../../support/complex/default-integration-test-product');

describe('Get configuration scenarios', () => {
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

  describe('Get configuration', () => {
    it('should fail to get a configuration if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

      const configurationId = setup.gen.string({ prefix: 'configuration-test' });

      await adminSession.resources.workspaceTypes
        .workspaceType(workspaceTypeId)
        .configurations()
        .create({
          id: configurationId,
        });

      await adminSession.resources.users.deactivateUser(adminSession2.user);

      await expect(
        adminSession2.resources.workspaceTypes
          .workspaceType(workspaceTypeId)
          .configurations()
          .configuration(configurationId)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });
  });

  it('should fail to get a configuration if user is anonymous', async () => {
    const anonymousSession = await setup.createAnonymousSession();
    const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

    await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

    const configurationId = setup.gen.string({ prefix: 'configuration-test' });

    await adminSession.resources.workspaceTypes
      .workspaceType(workspaceTypeId)
      .configurations()
      .create({
        id: configurationId,
      });

    await expect(
      anonymousSession.resources.workspaceTypes
        .workspaceType(workspaceTypeId)
        .configurations()
        .configuration(configurationId)
        .get(),
    ).rejects.toMatchObject({
      code: errorCode.http.code.badImplementation,
    });
  });

  it("should fail if user's role does not have access", async () => {
    const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

    await adminSession.resources.workspaceTypes.create(
      addProductInfo({ id: workspaceTypeId, status: 'approved' }, productInfo),
    );

    const configurationId = setup.gen.string({ prefix: 'configuration-test' });

    await adminSession.resources.workspaceTypes
      .workspaceType(workspaceTypeId)
      .configurations()
      .create({
        id: configurationId,
        denyRoleIds: ['researcher'],
      });

    const researcherSession = await setup.createResearcherSession();

    await expect(
      researcherSession.resources.workspaceTypes
        .workspaceType(workspaceTypeId)
        .configurations()
        .configuration(configurationId)
        .get(),
    ).rejects.toMatchObject({
      code: errorCode.http.code.notFound,
    });
  });

  it("should get a configuration if user's role has access", async () => {
    const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

    await adminSession.resources.workspaceTypes.create(
      addProductInfo({ id: workspaceTypeId, status: 'approved' }, productInfo),
    );

    const configurationId = setup.gen.string({ prefix: 'configuration-test' });

    await adminSession.resources.workspaceTypes
      .workspaceType(workspaceTypeId)
      .configurations()
      .create({
        id: configurationId,
        allowRoleIds: ['researcher'],
      });

    const researcherSession = await setup.createResearcherSession();

    await expect(
      researcherSession.resources.workspaceTypes
        .workspaceType(workspaceTypeId)
        .configurations()
        .configuration(configurationId)
        .get(),
    ).resolves.toHaveProperty('id', configurationId);
  });
});
