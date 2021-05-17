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

describe('Delete user scenarios', () => {
  let setup;
  let defaultUser;
  let uid;
  let adminSession;
  let username;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    username = setup.gen.username();
    defaultUser = adminSession.resources.users.defaults({ username });

    const defaultUserDetail = await adminSession.resources.users.create(defaultUser);
    uid = defaultUserDetail.uid;
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('delete user', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.users.user(uid).delete()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin1Session.user);
      await expect(admin1Session.resources.users.user(uid).delete()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should delete user successfully', async () => {
      await expect(adminSession.resources.users.user(uid).delete()).resolves.toMatchObject({
        message: `user ${username} deleted`,
      });
    });

    it('should fail for deleting user that does not exist', async () => {
      const user1name = setup.gen.username();
      const user1Detail = await adminSession.resources.users.create({
        ...defaultUser,
        username: user1name,
        email: user1name,
      });
      await adminSession.resources.users.user(user1Detail.uid).delete();
      await expect(adminSession.resources.users.user(user1Detail.uid).delete()).rejects.toMatchObject({
        code: errorCode.http.code.notFound,
      });
    });
  });
});
