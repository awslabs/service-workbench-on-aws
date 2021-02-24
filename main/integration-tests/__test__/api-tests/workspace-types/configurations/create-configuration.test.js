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

describe('Create configuration scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Create configuration', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      await adminSession.resources.users.deactivateUser(adminSession2.user);

      const configurationId = setup.gen.string({ prefix: 'configuration-test' });

      await expect(
        adminSession2.resources.workspaceTypes
          .workspaceType(workspaceTypeId)
          .configurations()
          .create({
            id: configurationId,
          }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is not admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const configurationId = setup.gen.string({ prefix: 'configuration-test' });

      await expect(
        researcherSession.resources.workspaceTypes
          .workspaceType(workspaceTypeId)
          .configurations()
          .create({
            id: configurationId,
          }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const configurationId = setup.gen.string({ prefix: 'configuration-test' });

      await expect(
        anonymousSession.resources.workspaceTypes
          .workspaceType(workspaceTypeId)
          .configurations()
          .create({
            id: configurationId,
          }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail if input is not valid', async () => {
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const configurationId = setup.gen.string({ prefix: 'configuration-test' });

      await expect(
        adminSession.resources.workspaceTypes
          .workspaceType(workspaceTypeId)
          .configurations()
          .create({
            id: configurationId,
            invalid: 'data',
          }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should create if user is admin', async () => {
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const configurationId = setup.gen.string({ prefix: 'configuration-test' });

      await expect(
        adminSession.resources.workspaceTypes
          .workspaceType(workspaceTypeId)
          .configurations()
          .create({
            id: configurationId,
          }),
      ).resolves.toHaveProperty('id', configurationId);
    });
  });
});
