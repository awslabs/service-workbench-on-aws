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

describe('Update workspace-type scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Update workspace-type', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const updateBody = {
        id: workspaceTypeId,
        desc: setup.gen.description(),
        rev: 0,
      };

      await adminSession2.resources.users.deactivateUser(adminSession2.user);

      await expect(adminSession2.resources.workspaceTypes.update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is not admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const updateBody = {
        id: workspaceTypeId,
        desc: setup.gen.description(),
        rev: 0,
      };

      await expect(researcherSession.resources.workspaceTypes.update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const updateBody = {
        id: workspaceTypeId,
        desc: setup.gen.description(),
        rev: 0,
      };

      await expect(anonymousSession.resources.workspaceTypes.update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail if input schema is not valid', async () => {
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const updateBody = {
        id: workspaceTypeId,
        invalid: 'data',
        rev: 0,
      };

      await expect(adminSession.resources.workspaceTypes.update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should update if user is admin', async () => {
      const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });

      await adminSession.resources.workspaceTypes.create({
        id: workspaceTypeId,
      });

      const updateBody = {
        id: workspaceTypeId,
        desc: setup.gen.description(),
        rev: 0,
      };

      await expect(adminSession.resources.workspaceTypes.update(updateBody)).resolves.toHaveProperty(
        'id',
        workspaceTypeId,
      );
    });
  });
});
