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

describe('Bulk Create user scenarios', () => {
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

    it.each(['researcher', 'guest', 'internal-guest'])('should fail for inactive %p', async role => {
      const nonAdminSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await adminSession.resources.users.deactivateUser(nonAdminSession.user);
      await expect(nonAdminSession.resources.users.bulkAddUsers([defaultUser])).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it.each(['researcher', 'guest', 'internal-guest'])('should fail for %p', async role => {
      const nonAdminSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await expect(nonAdminSession.resources.users.bulkAddUsers([defaultUser])).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for inactive admin', async () => {
      const testAdminSession = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(testAdminSession.user);
      await expect(testAdminSession.resources.users.bulkAddUsers([defaultUser])).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should create users successfully as admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await expect(admin1Session.resources.users.bulkAddUsers([defaultUser])).resolves.toMatchObject({
        errorCount: 0,
        successCount: 1,
      });
    });

    it('should fail with badRequest code for adding users that already exist as admin', async () => {
      const admin1Session = await setup.createAdminSession();
      const newUser = admin1Session.resources.users.defaults();
      await expect(admin1Session.resources.users.bulkAddUsers([defaultUser, newUser])).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail for adding root user as admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await expect(
        admin1Session.resources.users.bulkAddUsers([
          { ...defaultUser, isAdmin: true, userRole: 'admin', userType: 'root' },
        ]),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail with badRequest code for adding malformed users as admin', async () => {
      const admin1Session = await setup.createAdminSession();
      const badUser = {};
      const newUser = admin1Session.resources.users.defaults();
      await expect(admin1Session.resources.users.bulkAddUsers([newUser, badUser])).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });
  });
});
