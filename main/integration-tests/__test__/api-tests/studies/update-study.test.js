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

describe('Update study scenarios', () => {
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

  describe('Updating studies', () => {
    it('should fail while trying to update Open Data studies by a non-admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      // This is a known Open Data study
      const studyId = '1000-genomes';

      // We need to make sure that the study id above belongs to an open data study
      const study = await adminSession.resources.studies.mustFind(studyId, 'Open Data');
      const updateBody = { rev: study.rev, description: setup.gen.description(), id: studyId };

      await expect(researcherSession.resources.studies.study(studyId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail while trying to update Open Data studies for anonymous user', async () => {
      // This is a known Open Data study
      const studyId = '1000-genomes';

      // We need to make sure that the study id above belongs to an open data study
      const study = await adminSession.resources.studies.mustFind(studyId, 'Open Data');
      const updateBody = { rev: study.rev, description: setup.gen.description(), id: studyId };

      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.studies.study(studyId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail while trying to update Open Data studies for internal guest user', async () => {
      // This is a known Open Data study
      const studyId = '1000-genomes';

      // We need to make sure that the study id above belongs to an open data study
      const study = await adminSession.resources.studies.mustFind(studyId, 'Open Data');
      const updateBody = { rev: study.rev, description: setup.gen.description(), id: studyId };

      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(guestSession.resources.studies.study(studyId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail while trying to update Open Data studies for external guest user', async () => {
      // This is a known Open Data study
      const studyId = '1000-genomes';

      // We need to make sure that the study id above belongs to an open data study
      const study = await adminSession.resources.studies.mustFind(studyId, 'Open Data');
      const updateBody = { rev: study.rev, description: setup.gen.description(), id: studyId };

      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(guestSession.resources.studies.study(studyId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should update study as expected', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-study-test' });
      const study = {
        id,
        category: 'My Studies',
      };

      await researcherSession.resources.studies.create(study);

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      const retVal = await researcherSession.resources.studies.study(study.id).update(updateBody);

      expect(retVal).toStrictEqual(
        expect.objectContaining({
          description: updateBody.description,
        }),
      );
    });

    it('should fail to update My Study for internal guest', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-study-test' });
      const study = {
        id,
        category: 'My Studies',
      };

      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      await researcherSession.resources.studies.create(study);

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(guestSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to update My Study for external guest', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-study-test' });
      const study = {
        id,
        category: 'My Studies',
      };

      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });

      await researcherSession.resources.studies.create(study);

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(guestSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should pass to update My Study for non-study-admin sysadmin user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-my-study-test-sysadmin' });
      const study = {
        id,
        category: 'My Studies',
      };

      const sysAdminSession = await setup.createAdminSession();

      await researcherSession.resources.studies.create(study);

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(sysAdminSession.resources.studies.study(study.id).update(updateBody)).resolves.toMatchObject({
        description: setup.gen.description(),
        id,
      });
    });

    it('should pass to update Org Study for non-owner sysadmin', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-org-study-test-sysadmin' });
      const study = {
        id,
        category: 'Organization',
      };

      const sysAdminSession = await setup.createAdminSession();

      await researcherSession.resources.studies.create(study);

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(sysAdminSession.resources.studies.study(study.id).update(updateBody)).resolves.toMatchObject({
        description: setup.gen.description(),
        id,
      });
    });

    it('should fail to update Org Study for internal guest', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-study-test-int-guest' });
      const study = {
        id,
        category: 'Organization',
      };

      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      await researcherSession.resources.studies.create(study);

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(guestSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to update Org Study for external guest', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-study-test-ext-guest' });
      const study = {
        id,
        category: 'Organization',
      };

      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });

      await researcherSession.resources.studies.create(study);

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(guestSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail while trying to update Open Data studies for sysAdmin user', async () => {
      // This is a known Open Data study
      const studyId = '1000-genomes';

      // We need to make sure that the study id above belongs to an open data study
      const study = await adminSession.resources.studies.mustFind(studyId, 'Open Data');

      const updateBody = { rev: study.rev, description: setup.gen.description(), id: studyId };

      const sysAdminSession = await setup.createAdminSession();
      await expect(sysAdminSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });
  });

  describe('Updating BYOB study', () => {
    it('should fail to update BYOB study with anonymous users', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob' });
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

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(anonymousSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail to update BYOB study with internal guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob-int-guest' });
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

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(guestSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to update BYOB study with external guest users', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob-ext-guest' });
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

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(guestSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail to update BYOB study with unauthorized users', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob' });
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

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(researcherSession.resources.studies.study(study.id).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should update BYOB study', async () => {
      const tempStudyAdmin = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob' });
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

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(admin2Session.resources.studies.study(study.id).update(updateBody)).resolves.toStrictEqual(
        expect.objectContaining({
          description: updateBody.description,
        }),
      );
    });

    it('should update BYOB study by other sysAdmin', async () => {
      const tempStudyAdmin = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const otherSysAdminSession = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob-sysadmin' });
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

      const updateBody = { rev: study.rev, description: setup.gen.description(), id };

      await expect(otherSysAdminSession.resources.studies.study(study.id).update(updateBody)).resolves.toStrictEqual(
        expect.objectContaining({
          description: updateBody.description,
        }),
      );
    });
  });
});
