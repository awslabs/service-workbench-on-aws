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

const { sleep } = require('@aws-ee/base-services/lib/helpers/utils');
const { runSetup } = require('../../../support/setup');
const errorCode = require('../../../support/utils/error-code');

describe('Create user logout scenarios', () => {
  let setup;

  beforeAll(async () => {
    setup = await runSetup();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Revoking an authentication token upon user logout', () => {
    it('should revoke auth token', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(researcherSession.resources.authentication.logout()).resolves.toMatchObject({ revoked: true });
    });

    it('should fail to perform operations with a revoked auth token', async () => {
      const researcherSession = await setup.createResearcherSession();

      // Since this is a new user not assigned to any study
      await expect(researcherSession.resources.studies.get()).resolves.toStrictEqual([]);

      // Perform the logout logic
      await expect(researcherSession.resources.authentication.logout()).resolves.toMatchObject({ revoked: true });
      // We need to let ApiGateway cache to refresh which takes about 5min.
      // So we pause the test for 6min
      await sleep(6 * 60 * 1000);

      // Verify the user can no longer get a resolved response for the get studies list request as before
      await expect(researcherSession.resources.studies.get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.authentication.logout()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
