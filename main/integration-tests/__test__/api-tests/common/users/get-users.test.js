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

const _ = require('lodash');
const { runSetup } = require('../../../../support/setup');
const errorCode = require('../../../../support/utils/error-code');

describe('Get user scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Get users', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.users.get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it.each(['researcher', 'guest', 'internal-guest'])('should fail for inactive %p', async role => {
      const nonAdminSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await adminSession.resources.users.deactivateUser(nonAdminSession.user);
      await expect(nonAdminSession.resources.users.get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it.each(['guest', 'internal-guest'])('should fail for %p', async role => {
      const nonAdminSession = await setup.createUserSession({ userRole: role, projectId: [] });
      await expect(nonAdminSession.resources.users.get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return redacted list for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const result = await researcherSession.resources.users.get();
      expect(result.length).toBeGreaterThan(0);
      const filteredResult = _.filter(
        result,
        user => _.has(user, 'isAdmin') || _.has(user, 'userRole') || _.has(user, 'encryptedCreds'),
      );
      expect(filteredResult.length).toEqual(0);
    });

    it('should return full list for Admin', async () => {
      const testAdminSession = await setup.createAdminSession();
      const result = await testAdminSession.resources.users.get();
      expect(result.length).toBeGreaterThan(0);
      const filteredResult = _.filter(result, user => _.has(user, 'isAdmin') && _.has(user, 'userRole'));
      expect(filteredResult.length).toEqual(result.length);
    });
    it('should fail if inactive admin attempts to get users', async () => {
      const testAdminSession = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(testAdminSession.user);
      await expect(testAdminSession.resources.users.get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });
  });
});
