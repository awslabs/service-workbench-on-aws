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

describe('Get workspace-types scenarios', () => {
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

  describe('Get workspace-types', () => {
    it('should fail to get approved workspaces if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      await adminSession2.resources.users.deactivateUser(adminSession2.user);

      await expect(adminSession2.resources.workspaceTypes.getApproved()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail to get not-approved workspaces if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      await adminSession2.resources.users.deactivateUser(adminSession2.user);

      await expect(adminSession2.resources.workspaceTypes.getNotApproved()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail to get approved workspaces if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();

      await expect(anonymousSession.resources.workspaceTypes.getApproved()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail to get not-approved workspaces if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();

      await expect(anonymousSession.resources.workspaceTypes.getNotApproved()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should return approved workspaces if user is researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(
        addProductInfo({ id: workspaceTypeId, status: 'approved' }, productInfo),
      );

      await expect(researcherSession.resources.workspaceTypes.getApproved()).resolves.not.toHaveLength(0);
    });

    it('should return no not-approved workspaces if user is researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(
        addProductInfo({ id: workspaceTypeId, status: 'not-approved' }, productInfo),
      );

      await expect(researcherSession.resources.workspaceTypes.getNotApproved()).resolves.toHaveLength(0);
    });

    it('should return approved workspaces if user is admin', async () => {
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(
        addProductInfo({ id: workspaceTypeId, status: 'approved' }, productInfo),
      );

      await expect(adminSession.resources.workspaceTypes.getApproved()).resolves.not.toHaveLength(0);
    });

    it('should return not-approved workspaces if user is admin', async () => {
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create(
        addProductInfo({ id: workspaceTypeId, status: 'not-approved' }, productInfo),
      );

      await expect(adminSession.resources.workspaceTypes.getNotApproved()).resolves.not.toHaveLength(0);
    });
  });
});
