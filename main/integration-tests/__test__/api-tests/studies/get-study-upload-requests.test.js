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

describe('Study files upload request scenarios', () => {
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
  describe.each(studyCategoryCases)('Study files upload request for %p', (studyPrefix, studyCategory) => {
    it(`should fail when inactive user tries upload files to ${studyPrefix}`, async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `upload-file-${studyPrefix}-test-inactive-user` });

      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for anonymous user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `upload-file-${studyPrefix}-test-anon-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.studies
          .study(studyId)
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for internal guest user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `upload-file-${studyPrefix}-test-int-guest` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(
        guestSession.resources.studies
          .study(studyId)
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for other sysadmin user', async () => {
      const studyAdmin = await setup.createResearcherSession();
      const sysadmin = await setup.createAdminSession();
      const studyId = setup.gen.string({ prefix: `upload-file-${studyPrefix}-test-sysadmin` });
      await studyAdmin.resources.studies.create({ id: studyId, category: studyCategory });

      await expect(
        sysadmin.resources.studies
          .study(studyId)
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `upload-file-${studyPrefix}-test-ext-guest` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(
        guestSession.resources.studies
          .study(studyId)
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });
  });

  describe('BYOB study files upload request', () => {
    it('should fail BYOB study files upload request with anonymous users', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'upload-file-test-byob' });
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
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail BYOB study files upload request with internal guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'upload-file-test-byob-int-guest' });
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
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail BYOB study files upload request with external guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'upload-file-test-byob-ext-guest' });
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
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail BYOB study files upload request with other sysadmin users', async () => {
      const studyAdmin = await setup.createAdminSession();
      const sysadmin = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'upload-file-test-byob-sysadmin' });
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
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail BYOB study files upload request with unauthorized researchers', async () => {
      const studyAdmin = await setup.createAdminSession();
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'upload-file-test-byob-unauth-researcher' });
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
        researcherSession.resources.studies
          .study(study.id)
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail BYOB study files upload request with authorized researchers', async () => {
      const studyAdmin = await setup.createAdminSession();
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'upload-file-test-byob-auth-researcher' });
      const study = {
        id,
        adminUsers: [studyAdmin.user.uid, researcherSession.user.uid],
      };

      await studyAdmin.resources.dataSources.accounts
        .account(accountId)
        .buckets()
        .bucket(bucketName)
        .studies()
        .create(study);

      await expect(
        researcherSession.resources.studies
          .study(study.id)
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail BYOB study files upload request with DS studies', async () => {
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'upload-file-test-byob' });
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
          .uploadRequest()
          .getPresignedRequests('dummyFile1'),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });
  });
});
