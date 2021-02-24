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
const { runSetup } = require('../../../support/setup');
const errorCode = require('../../../support/utils/error-code');

describe('Create user scenarios', () => {
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

    it('should fail for inactive user', async () => {
      const admin1Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin1Session.user);
      await expect(admin1Session.resources.users.get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
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
      const admin1Session = await setup.createAdminSession();
      const result = await admin1Session.resources.users.get();
      expect(result.length).toBeGreaterThan(0);
      const filteredResult = _.filter(result, user => _.has(user, 'isAdmin') && _.has(user, 'userRole'));
      expect(filteredResult.length).toEqual(result.length);
    });
  });
});
