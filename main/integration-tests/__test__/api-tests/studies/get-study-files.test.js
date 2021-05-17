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

describe('List study files scenarios', () => {
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
  describe.each(studyCategoryCases)('Listing %p files', (studyPrefix, studyCategory) => {
    it(`should return an empty list while trying to get files of a newly created ${studyPrefix}`, async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-files-${studyPrefix}-test-empty-files` });

      // Newly created study which does not have any files associated
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).resolves.toStrictEqual([]);
    });

    it(`should fail when inactive user tries get files of ${studyPrefix}`, async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-files-${studyPrefix}-test-inactive-user` });

      // Newly created study which does not have any files associated
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      await adminSession.resources.users.deactivateUser(researcherSession.user);
      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for anonymous user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-files-${studyPrefix}-test-anon-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for internal guest user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-files-${studyPrefix}-test-int-guest-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(
        guestSession.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-files-${studyPrefix}-test-ext-guest-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(
        guestSession.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should pass for sysadmin user', async () => {
      const studyAdmin = await setup.createResearcherSession();
      const sysadmin = await setup.createAdminSession();
      const studyId = setup.gen.string({ prefix: `get-files-${studyPrefix}-test-sysadmin` });
      await studyAdmin.resources.studies.create({ id: studyId, category: studyCategory });

      await expect(
        sysadmin.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).resolves.toStrictEqual([]);
    });
  });

  describe('Get BYOB study files', () => {
    it('should fail to get BYOB study files with anonymous users', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-files-test-byob' });
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
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail to fetch BYOB study files with unauthorized users', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-files-test-byob' });
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
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to fetch BYOB study files with internal guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-files-test-byob-int-guest' });
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
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to fetch BYOB study files with external guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-files-test-byob-ext-guest' });
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
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should pass to fetch BYOB study files with sysadmin users', async () => {
      const studyAdmin = await setup.createAdminSession();
      const sysadmin = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-files-test-byob-sysadmin' });
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
          .files()
          .get(),
      ).resolves.toStrictEqual([]);
    });

    it('should get empty BYOB study files', async () => {
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-files-test-byob' });
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
        admin2Session.resources.studies
          .study(study.id)
          .files()
          .get(),
      ).resolves.toStrictEqual([]);
    });
  });
});
