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

const categoryCases = [
  ['my-study', 'My Studies'],
  ['org-study', 'Organization'],
];
describe('Get study scenarios', () => {
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

  describe.each(categoryCases)('Getting %p', (studyPrefix, studyCategory) => {
    it('should fail if user is inactive', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-test-inactive-user` });

      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });
      await adminSession.resources.users.deactivateUser(researcherSession.user);
      await expect(researcherSession.resources.studies.study(studyId).get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is not owner', async () => {
      const researcher1session = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-test-non-owner` });

      await researcher1session.resources.studies.create({ id: studyId, category: studyCategory });
      const researcher2session = await setup.createResearcherSession();
      await expect(researcher2session.resources.studies.study(studyId).get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-test-anon-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.studies.study(studyId).get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });

  describe('Getting a BYOB study', () => {
    it('should fail to fetch BYOB study with anonymous users', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-test-byob' });
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

      await expect(anonymousSession.resources.studies.study(study.id).get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail to fetch BYOB study with unauthorized users', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-test-byob' });
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

      await expect(researcherSession.resources.studies.study(study.id).get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return BYOB study with Organization category', async () => {
      const researcherSession = await setup.createResearcherSession();
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'get-study-test-byob' });
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

      await expect(researcherSession.resources.studies.study(study.id).get()).resolves.toEqual(
        expect.objectContaining({ bucket: bucketName, id: study.id, accountId }),
      );
    });
  });
});
