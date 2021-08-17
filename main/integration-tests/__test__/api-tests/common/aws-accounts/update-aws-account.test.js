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

const { runSetup } = require('../../../../support/setup');
const errorCode = require('../../../../support/utils/error-code');

describe('AWS Account Permissions scenarios', () => {
  let setup;
  let adminSession;
  let accountId;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    accountId = setup.defaults.awsAccount.id;
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Update AWS Account', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.awsAccounts
          .awsAccount(accountId)
          .update({ rev: 0, id: accountId, description: 'test' }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin1Session.user);
      await expect(
        admin1Session.resources.awsAccounts
          .awsAccount(accountId)
          .update({ rev: 0, id: accountId, description: 'test' }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for non-admins', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(
        researcherSession.resources.awsAccounts
          .awsAccount(accountId)
          .update({ rev: 0, id: accountId, description: 'test' }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should update aws account successfully for admin', async () => {
      const account = await adminSession.resources.awsAccounts.awsAccount(accountId).get();
      await expect(
        adminSession.resources.awsAccounts
          .awsAccount(accountId)
          .update({ rev: account.rev, id: accountId, description: 'test' }),
      ).resolves.toMatchObject({
        id: accountId,
        description: 'test',
      });
    });
  });
});
