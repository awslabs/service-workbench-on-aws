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

describe('Register data source study scenarios', () => {
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

    // We register a bucket to be used by all the tests in this test suite
    bucketName = setup.gen.string({ prefix: 'ds-bucket-test' });
    await adminSession.resources.dataSources.accounts
      .account(accountId)
      .buckets()
      .create({ name: bucketName });
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Registering a data source study', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const id = setup.gen.string({ prefix: 'ds-study-id-test' });
      const study = {
        id,
        adminUsers: [adminSession.user.uid],
      };

      await expect(
        anonymousSession.resources.dataSources.accounts
          .account(accountId)
          .buckets()
          .bucket(bucketName)
          .studies()
          .create(study),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'ds-study-id-test' });
      const study = {
        id,
        adminUsers: [researcherSession.user.uid],
      };

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.dataSources.accounts
          .account(accountId)
          .buckets()
          .bucket(bucketName)
          .studies()
          .create(study),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const id = setup.gen.string({ prefix: 'ds-study-id-test' });
      const study = {
        id,
        adminUsers: [guestSession.user.uid],
      };

      await expect(
        guestSession.resources.dataSources.accounts
          .account(accountId)
          .buckets()
          .bucket(bucketName)
          .studies()
          .create(study),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const id = setup.gen.string({ prefix: 'ds-study-id-test' });
      const study = {
        id,
        adminUsers: [guestSession.user.uid],
      };

      await expect(
        guestSession.resources.dataSources.accounts
          .account(accountId)
          .buckets()
          .bucket(bucketName)
          .studies()
          .create(study),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'ds-study-id-test' });
      const study = {
        id,
        adminUsers: [researcherSession.user.uid],
      };

      await expect(
        researcherSession.resources.dataSources.accounts
          .account(accountId)
          .buckets()
          .bucket(bucketName)
          .studies()
          .create(study),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return study registration information if admin', async () => {
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'ds-study-id-test' });
      const study = {
        id,
        adminUsers: [admin2Session.user.uid],
      };

      await expect(
        admin2Session.resources.dataSources.accounts
          .account(accountId)
          .buckets()
          .bucket(bucketName)
          .studies()
          .create(study),
      ).resolves.toMatchObject({ id, accountId, bucket: bucketName });
    });
  });
});
