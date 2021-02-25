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

describe('Update user scenarios', () => {
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

  describe('Update user', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.users.user(uid).update({ rev: 0, firstName: 'John' }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive admin', async () => {
      const admin1Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin1Session.user);
      await expect(
        admin1Session.resources.users.user(uid).update({ rev: 0, firstName: 'John' }),
      ).rejects.toMatchObject({ code: errorCode.http.code.unauthorized });
    });

    it('should update other user successfully for admin', async () => {
      await expect(adminSession.resources.users.user(uid).update({ rev: 0, firstName: 'John' })).resolves.toMatchObject(
        {
          uid,
          firstName: 'John',
        },
      );
    });

    it.each(['researcher', 'guest', 'internal-guest'])('should update self successfully for %a', async a => {
      const nonAdminSession = await setup.createUserSession({ userRole: a, projectId: [] });
      await expect(
        nonAdminSession.resources.users.user(nonAdminSession.user.uid).update({ rev: 0, firstName: 'John' }),
      ).resolves.toMatchObject({
        uid: nonAdminSession.user.uid,
        firstName: 'John',
      });
    });

    it.each(['researcher', 'guest', 'internal-guest'])('should fail if %a update restrictive fields', async a => {
      const nonAdminSession = await setup.createUserSession({ userRole: a, projectId: [] });
      await expect(
        nonAdminSession.resources.users.user(nonAdminSession.user.uid).update({ rev: 0, isAdmin: true }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
      const projectId = setup.defaults.project.id;
      await expect(
        nonAdminSession.resources.users.user(nonAdminSession.user.uid).update({ rev: 0, projectId: [projectId] }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it.each(['researcher', 'guest', 'internal-guest'])('should fail if %a update other user', async a => {
      const nonAdminSession = await setup.createUserSession({ userRole: a, projectId: [] });
      await expect(
        nonAdminSession.resources.users.user(uid).update({ rev: 0, firstName: 'John' }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });
  });
});
