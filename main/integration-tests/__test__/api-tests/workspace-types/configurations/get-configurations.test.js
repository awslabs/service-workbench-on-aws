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

describe('Get configurations scenarios', () => {
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

  describe('Get configurations', () => {
    it('should fail to get all configurations if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

      await adminSession.resources.users.deactivateUser(adminSession2.user);

      await expect(
        adminSession2.resources.workspaceTypes
          .workspaceType(workspaceTypeId)
          .configurations()
          .getAll(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });
  });

  it('should fail to get all configurations if user is anonymous', async () => {
    const anonymousSession = await setup.createAnonymousSession();
    const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

    await adminSession.resources.workspaceTypes.create(addProductInfo({ id: workspaceTypeId }, productInfo));

    await expect(
      anonymousSession.resources.workspaceTypes
        .workspaceType(workspaceTypeId)
        .configurations()
        .getAll(),
    ).rejects.toMatchObject({
      code: errorCode.http.code.badImplementation,
    });
  });

  it('should return all configurations if user is admin', async () => {
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
      adminSession.resources.workspaceTypes
        .workspaceType(workspaceTypeId)
        .configurations()
        .getAll(),
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: configurationId })]));
  });

  it('should not return configurations if a user does not have access', async () => {
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
        .getAll(),
    ).resolves.toHaveLength(0);
  });

  it('should return configurations when a user has access', async () => {
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
        .getAll(),
    ).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: configurationId })]));
  });
});
