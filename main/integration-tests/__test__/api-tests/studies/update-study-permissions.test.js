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

describe('Update study permissions scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  const studyCategoryCases = [
    ['my-study', 'My Studies'],
    ['org-study', 'Organization'],
  ];
  describe('Update study permissions', () => {
    it.each(studyCategoryCases)(
      'should fail if inactive user tries to update %p permissions',
      async (studyPrefix, studyCategory) => {
        const researcherSession = await setup.createResearcherSession();
        const studyId = setup.gen.string({ prefix: `update-${studyPrefix}-perm-test-inactive-user` });
        await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });
        await adminSession.resources.users.deactivateUser(researcherSession.user);

        await expect(
          researcherSession.resources.studies
            .study(studyId)
            .permissions()
            .update(),
        ).rejects.toMatchObject({
          code: errorCode.http.code.unauthorized,
        });
      },
    );

    it.each(studyCategoryCases)(
      'should fail if a user tries to update permissions of %p for which they are not the admin',
      async (studyPrefix, studyCategory) => {
        const researcher1Session = await setup.createResearcherSession();
        const studyId = setup.gen.string({ prefix: `update-${studyPrefix}-perm-test-researcher` });
        await researcher1Session.resources.studies.create({ id: studyId, category: studyCategory });

        // This user is brand new and does not have any permissions to [studyId] yet
        const researcher2Session = await setup.createResearcherSession();

        await expect(
          researcher2Session.resources.studies
            .study(studyId)
            .permissions()
            .update(),
        ).rejects.toMatchObject({
          code: errorCode.http.code.notFound,
        });
      },
    );

    it.each(studyCategoryCases)('should fail for anonymous user for %p', async (studyPrefix, studyCategory) => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `update-${studyPrefix}-perm-test-anon-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.studies
          .study(studyId)
          .permissions()
          .update(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should pass if a user tries to update permissions of an Organization for which they are the admin', async () => {
      const studyAdminSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'update-org-study-perm-test-study-admin' });
      await studyAdminSession.resources.studies.create({ id: studyId, category: 'Organization' });
      const readonlyUserSession = await setup.createResearcherSession();
      const readwriteUserSession = await setup.createResearcherSession();

      const readwriteuser = {
        uid: readwriteUserSession.user.uid,
        permissionLevel: 'readwrite',
      };
      const readonlyuser = {
        uid: readonlyUserSession.user.uid,
        permissionLevel: 'readonly',
      };
      const adminuser = {
        uid: studyAdminSession.user.uid,
        permissionLevel: 'admin',
      };
      const updateRequest = {
        usersToAdd: [readonlyuser, adminuser, readwriteuser],
        usersToRemove: [],
      };

      const retVal = await studyAdminSession.resources.studies
        .study(studyId)
        .permissions()
        .update(updateRequest);

      expect(retVal.adminUsers).toStrictEqual([studyAdminSession.user.uid]);
      expect(retVal.readonlyUsers).toStrictEqual([readonlyUserSession.user.uid]);
      expect(retVal.readwriteUsers).toStrictEqual([readwriteUserSession.user.uid]);
      expect(retVal.writeonlyUsers).toStrictEqual([]);
    });
  });
});
