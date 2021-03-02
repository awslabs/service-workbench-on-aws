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

describe('List indexes scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('List indexes', () => {
    it('should fail if user is inactive', async () => {
      const admin2Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin2Session.user);

      await expect(admin2Session.resources.indexes.get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should return empty index list for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(guestSession.resources.indexes.get()).resolves.toStrictEqual([]);
    });

    it('should return empty index list for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(guestSession.resources.indexes.get()).resolves.toStrictEqual([]);
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.indexes.get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
