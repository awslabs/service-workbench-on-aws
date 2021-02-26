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

describe('Create keypair scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  const userRoles = ['admin', 'researcher', 'guest', 'internal-guest'];

  describe('Create key pair', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.keyPairs.create()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it.each(userRoles)('should fail for inactive %userRole', async userRole => {
      const userSession = await setup.createUserSession({ userRole, projectId: [] });
      await adminSession.resources.users.deactivateUser(userSession.user);
      await expect(userSession.resources.keyPairs.create()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it.each(userRoles)('should succeed for %userRole', async userRole => {
      const userSession = await setup.createUserSession({ userRole, projectId: [] });
      await expect(userSession.resources.keyPairs.create()).resolves.toMatchObject({
        createdBy: userSession.user.uid,
      });
    });
  });
});
