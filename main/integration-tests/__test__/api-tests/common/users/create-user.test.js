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

  describe('create user', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.users.create(defaultUser)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it.each(['researcher', 'guest', 'internal-guest'])('should fail for inactive %p', async role => {
      const nonAdminSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await adminSession.resources.users.deactivateUser(nonAdminSession.user);
      await expect(nonAdminSession.resources.users.create(defaultUser)).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it.each(['researcher', 'guest', 'internal-guest'])('should fail for %p', async role => {
      const nonAdminSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await expect(nonAdminSession.resources.users.create(defaultUser)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for inactive admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin1Session.user);
      await expect(admin1Session.resources.users.create(defaultUser)).rejects.toEqual(
        expect.objectContaining({ code: errorCode.http.code.unauthorized }),
      );
    });

    it('should fail for creating root user as admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await expect(
        admin1Session.resources.users.create({ ...defaultUser, isAdmin: true, userRole: 'admin', userType: 'root' }),
      ).rejects.toEqual(expect.objectContaining({ code: errorCode.http.code.forbidden }));
    });

    it('should create user successfully as admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await expect(admin1Session.resources.users.create(defaultUser)).resolves.toMatchObject({
        username,
      });
    });

    it('should fail for adding user that already exist as admin´', async () => {
      const admin1Session = await setup.createAdminSession();
      const username1 = setup.gen.username();
      await admin1Session.resources.users.create({ ...defaultUser, username: username1, email: username1 });
      await expect(
        admin1Session.resources.users.create({ ...defaultUser, username: username1, email: username1 }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.alreadyExists,
      });
    });
  });
});
