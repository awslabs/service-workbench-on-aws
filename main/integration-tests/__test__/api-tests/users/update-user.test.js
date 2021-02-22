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
    username = await setup.gen.username();
    const password = await setup.gen.password();

    defaultUser = {
      username,
      email: username,
      password,
      isAdmin: false,
      userRole: 'researcher',
    };

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
      await admin1Session.resources.currentUser.update({ status: 'inactive', rev: 0 });
      await expect(admin1Session.resources.users.user(uid).update({ rev: 0, firstName: 'John' })).rejects.toEqual(
        expect.objectContaining({ code: errorCode.http.code.unauthorized }),
      );
    });

    it('should update user successfully', async () => {
      await expect(adminSession.resources.users.user(uid).update({ rev: 0, firstName: 'John' })).resolves.toMatchObject(
        {
          uid,
          firstName: 'John',
        },
      );
    });

    it.each(['researcher', 'guest', 'internal-guest'])(
      'should fail if non-admin user update restrictive field %a',
      async a => {
        const researcherSession = await setup.createResearcherSession();
        await expect(researcherSession.resources.currentUser.update({ rev: 0, ...a })).rejects.toMatchObject({
          code: errorCode.http.code.forbidden,
        });
      },
    );
  });
});
