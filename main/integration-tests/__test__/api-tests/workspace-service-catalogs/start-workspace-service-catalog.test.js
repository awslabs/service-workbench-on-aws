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
const errorCode = require('../../../support/utils/error-code');

describe('Start workspace-service-catalog scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  async function createWorkspace(allowRoleIds = ['admin']) {
    const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });
    const configurationId = setup.gen.string({ prefix: 'configuration-test' });

    await adminSession.resources.workspaceTypes.create({ id: workspaceTypeId, status: 'approved' });
    await adminSession.resources.workspaceTypes
      .workspaceType(workspaceTypeId)
      .configurations()
      .create({ id: configurationId, allowRoleIds });

    return { workspaceTypeId, configurationId };
  }

  describe('Start workspace-service-catalog', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspace();

      await adminSession.resources.users.deactivateUser(adminSession2.user);

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        adminSession2.resources.workspaceServiceCatalogs.workspaceServiceCatalog(response.id).start(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspace();

      const response = await adminSession.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });

      await expect(
        anonymousSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(response.id).start(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
