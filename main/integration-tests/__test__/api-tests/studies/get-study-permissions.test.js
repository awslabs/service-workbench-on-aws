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

describe('Get study permissions scenarios', () => {
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
  describe.each(studyCategoryCases)('Get %p permissions', (studyPrefix, studyCategory) => {
    it(`should fail if inactive user tries to get ${studyPrefix} permissions`, async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-perm-test-inactive-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it(`should fail if a user tries to get permissions of ${studyPrefix} for which they are not the admin`, async () => {
      const researcher1Session = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-perm-test-non-study-admin` });
      await researcher1Session.resources.studies.create({ id: studyId, category: studyCategory });

      // This user is brand new and does not have any permissions to [studyId] yet
      const researcher2Session = await setup.createResearcherSession();

      // This error code might change once we merge with BYOB
      await expect(
        researcher2Session.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-perm-test-anon-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fetch study permissions for non-study-admin sysadmin user', async () => {
      const studyAdmin = await setup.createResearcherSession();
      const sysadmin = await setup.createAdminSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-perm-test-sysadmin` });
      await studyAdmin.resources.studies.create({ id: studyId, category: studyCategory });

      await expect(
        sysadmin.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).resolves.toEqual(
        expect.objectContaining({
          adminUsers: [studyAdmin.user.uid],
          readonlyUsers: [],
          readwriteUsers: [],
          writeonlyUsers: [],
        }),
      );
    });

    it('should fail for internal guest user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-perm-test-int-guest` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(
        guestSession.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-perm-test-ext-guest` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(
        guestSession.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });
  });

  describe('Getting BYOB study permissions', () => {
    it('should fail to fetch BYOB study permissions with anonymous users', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-perm-test-byob' });
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
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail to fetch BYOB study permissions with unauthorized users', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-perm-test-byob' });
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
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to fetch BYOB study permissions with researchers', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-perm-test-byob-researcher' });
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
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to fetch BYOB study permissions with internal guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-perm-test-byob-int-guest' });
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
        guestSession.resources.studies
          .study(study.id)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to fetch BYOB study permissions with external guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-perm-test-byob-ext-guest' });
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
        guestSession.resources.studies
          .study(study.id)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should pass to fetch BYOB study permissions with other sysadmin users', async () => {
      const studyAdmin = await setup.createAdminSession();
      const sysadmin = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-perm-test-byob-sysadmin' });
      const study = {
        id,
        adminUsers: [studyAdmin.user.uid],
      };

      await studyAdmin.resources.dataSources.accounts
        .account(accountId)
        .buckets()
        .bucket(bucketName)
        .studies()
        .create(study);

      await expect(
        sysadmin.resources.studies
          .study(study.id)
          .permissions()
          .get(),
      ).resolves.toEqual(
        expect.objectContaining({
          adminUsers: [studyAdmin.user.uid],
          readonlyUsers: [],
          readwriteUsers: [],
          writeonlyUsers: [],
        }),
      );
    });

    it('should return BYOB study permissions with Organization category', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-perm-test-byob' });
      const study = {
        id,
        adminUsers: [admin2Session.user.uid, researcherSession.user.uid],
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
          .get(),
      ).resolves.toEqual(expect.objectContaining({ adminUsers: [admin2Session.user.uid, researcherSession.user.uid] }));
    });
  });
});
