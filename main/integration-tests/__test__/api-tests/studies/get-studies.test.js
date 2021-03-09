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

describe('List study scenarios', () => {
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

  describe('Getting all studies of a category', () => {
    it('should return empty list if category is not defined', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(researcherSession.resources.studies.get()).resolves.toStrictEqual([]);
    });

    it('should fail if inactive user tries to list studies from any category', async () => {
      const researcherSession = await setup.createResearcherSession();
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.studies.getOpenData()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
      await expect(researcherSession.resources.studies.getMyStudies()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
      await expect(researcherSession.resources.studies.getOrganization()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.studies.getOpenData()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
      await expect(anonymousSession.resources.studies.getMyStudies()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
      await expect(anonymousSession.resources.studies.getOrganization()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    describe('Getting study list with BYOB studies', () => {
      it('should fail to fetch BYOB study with anonymous users', async () => {
        const anonymousSession = await setup.createAnonymousSession();
        const admin2Session = await setup.createAdminSession();
        const id = setup.gen.string({ prefix: 'get-studies-test-byob' });
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

        await expect(anonymousSession.resources.studies.getOrganization()).rejects.toMatchObject({
          code: errorCode.http.code.badImplementation,
        });
      });

      it('should fail to fetch BYOB studies with unauthorized users', async () => {
        const researcherSession = await setup.createResearcherSession();
        const admin2Session = await setup.createAdminSession();
        const id = setup.gen.string({ prefix: 'get-studies-test-byob' });
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

        await expect(researcherSession.resources.studies.getOrganization()).resolves.toEqual(
          expect.not.arrayContaining([expect.objectContaining({ bucket: bucketName, id: study.id, accountId })]),
        );
      });

      it('should return BYOB studies with Organization category', async () => {
        const researcherSession = await setup.createResearcherSession();
        const admin2Session = await setup.createAdminSession();
        const id = setup.gen.string({ prefix: 'get-studies-test-byob' });
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

        await expect(researcherSession.resources.studies.getOrganization()).resolves.toEqual(
          expect.arrayContaining([expect.objectContaining({ bucket: bucketName, id: study.id, accountId })]),
        );
      });
    });
  });
});
