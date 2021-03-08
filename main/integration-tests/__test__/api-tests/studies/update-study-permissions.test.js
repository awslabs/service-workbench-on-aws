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
  let accountId;
  let bucketName;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();

    // We register an account to be used by all the tests in this test suite
    accountId = setup.gen.accountId();
    await adminSession.resources.dataSources.accounts.create({ id: accountId });

    // We register a bucket to be used by all the BYOB-related tests in this test suite
    bucketName = setup.gen.string({ prefix: 'ds-study-test' });
    await adminSession.resources.dataSources.accounts
      .account(accountId)
      .buckets()
      .create({ name: bucketName });
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
          code: errorCode.http.code.forbidden,
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

  describe('Updating BYOB study permissions', () => {
    it('should fail to update BYOB study permissions with anonymous users', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-perm-test-byob' });
      const study = {
        id,
        adminUsers: [admin2Session.user.uid],
      };

      await admin2Session.resources.dataSources.accounts
        .account(accountId)
        .buckets()
        .bucket(bucketName)
        .studies()
        .create(study);

      await expect(
        anonymousSession.resources.studies
          .study(study.id)
          .permissions()
          .update(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail to update BYOB study permissions with unauthorized users', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-perm-test-byob' });
      const study = {
        id,
        adminUsers: [admin2Session.user.uid],
      };

      await admin2Session.resources.dataSources.accounts
        .account(accountId)
        .buckets()
        .bucket(bucketName)
        .studies()
        .create(study);

      await expect(
        researcherSession.resources.studies
          .study(study.id)
          .permissions()
          .update(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should update BYOB study permissions', async () => {
      const tempStudyAdmin = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-perm-test-byob' });
      const study = {
        id,
        adminUsers: [admin2Session.user.uid, tempStudyAdmin.user.uid],
      };

      await admin2Session.resources.dataSources.accounts
        .account(accountId)
        .buckets()
        .bucket(bucketName)
        .studies()
        .create(study);

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
        uid: admin2Session.user.uid,
        permissionLevel: 'admin',
      };
      const tempStudyAdminToRemove = {
        uid: tempStudyAdmin.user.uid,
        permissionLevel: 'admin',
      };
      const updateRequest = {
        usersToAdd: [readonlyuser, adminuser, readwriteuser],
        usersToRemove: [tempStudyAdminToRemove],
      };

      const retVal = await admin2Session.resources.studies
        .study(study.id)
        .permissions()
        .update(updateRequest);

      // Check if the returned body shows expected permission assignment
      expect(retVal.adminUsers).toStrictEqual([admin2Session.user.uid]);
      expect(retVal.readonlyUsers).toStrictEqual([readonlyUserSession.user.uid]);
      expect(retVal.readwriteUsers).toStrictEqual([readwriteUserSession.user.uid]);
      expect(retVal.writeonlyUsers).toStrictEqual([]);

      // Get study permissions separately and check if the returned body shows expected permission assignment
      await expect(
        admin2Session.resources.studies
          .study(study.id)
          .permissions()
          .get(),
      ).resolves.toStrictEqual(
        expect.objectContaining({
          adminUsers: [admin2Session.user.uid],
          readonlyUsers: [readonlyUserSession.user.uid],
          readwriteUsers: [readwriteUserSession.user.uid],
          writeonlyUsers: [],
        }),
      );
    });
  });
});
