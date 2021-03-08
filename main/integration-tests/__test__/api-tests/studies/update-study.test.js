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

  describe('Updating open data study', () => {
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
    it('should fail for anonymous user', async () => {
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

    it('should fail to fetch BYOB study with unauthorized users', async () => {
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

      const retVal = await admin2Session.resources.studies.study(study.id).update(updateBody);

      expect(retVal).toStrictEqual(
        expect.objectContaining({
          description: updateBody.description,
        }),
      );
    });
  });
});
