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

describe('Get data source accounts scenarios', () => {
  let setup;
  let adminSession;
  let accountId;
  let studyId;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();

    // We use a different admin session so that study resources (permission) table
    // can be cleaned
    const admin2Session = await setup.createAdminSession();

    // We register an account to be used by all the tests in this test suite
    accountId = setup.gen.accountId();
    await admin2Session.resources.dataSources.accounts.create({ id: accountId });

    // We register a bucket to be used by all the tests in this test suite
    const bucketName = setup.gen.string({ prefix: 'ds-bucket-test' });
    await admin2Session.resources.dataSources.accounts
      .account(accountId)
      .buckets()
      .create({ name: bucketName });

    // We register a study to be used by all the tests in this test suite
    studyId = setup.gen.string({ prefix: 'ds-study-id-test' });
    const study = {
      id: studyId,
      adminUsers: [admin2Session.user.uid],
    };

    await admin2Session.resources.dataSources.accounts
      .account(accountId)
      .buckets()
      .bucket(bucketName)
      .studies()
      .create(study);
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting data source accounts', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.dataSources.accounts
          .account(accountId)
          .studies()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.dataSources.accounts
          .account(accountId)
          .studies()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(
        guestSession.resources.dataSources.accounts
          .account(accountId)
          .studies()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(
        guestSession.resources.dataSources.accounts
          .account(accountId)
          .studies()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(
        researcherSession.resources.dataSources.accounts
          .account(accountId)
          .studies()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return registered data source studies if admin', async () => {
      await expect(
        adminSession.resources.dataSources.accounts
          .account(accountId)
          .studies()
          .get(),
      ).resolves.toMatchObject([expect.objectContaining({ id: studyId })]);
    });
  });
});
