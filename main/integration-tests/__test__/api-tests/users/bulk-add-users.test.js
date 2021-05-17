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

describe('Create user scenarios', () => {
  let setup;
  let defaultUser;
  let username;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    username = setup.gen.username();
    defaultUser = adminSession.resources.users.defaults({ username });
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Create user in bulk', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.users.bulkAddUsers([defaultUser])).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin1Session.user);
      await expect(admin1Session.resources.users.bulkAddUsers([defaultUser])).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should create users successfully', async () => {
      const admin1Session = await setup.createAdminSession();
      await expect(admin1Session.resources.users.bulkAddUsers([defaultUser])).resolves.toMatchObject({
        errorCount: 0,
        successCount: 1,
      });
    });

    it('should fail for adding user that already exist', async () => {
      const admin1Session = await setup.createAdminSession();
      const newUser = admin1Session.resources.users.defaults();
      await expect(admin1Session.resources.users.bulkAddUsers([defaultUser, newUser])).rejects.toMatchObject({
        code: errorCode.http.code.internalError,
      });
    });
  });
});
