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

describe('Get current user scenarios', () => {
  let setup;

  beforeAll(async () => {
    setup = await runSetup();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting current user', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.currentUser.get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should return current user information', async () => {
      const { session: researcher1Session, username } = await setup.createResearcherSessionAndUserName();
      await expect(researcher1Session.resources.currentUser.get()).resolves.toEqual(
        expect.objectContaining({ username }),
      );
    });

    it('should return current user information for inactive and pending user', async () => {
      const researcher2Session = await setup.createResearcherSession();
      await expect(researcher2Session.resources.currentUser.get()).resolves.toMatchObject({ status: 'active' });

      await researcher2Session.resources.currentUser.update({ status: 'inactive', rev: 0 });
      await expect(researcher2Session.resources.currentUser.get()).resolves.toMatchObject({ status: 'inactive' });

      await researcher2Session.resources.currentUser.update({ status: 'pending', rev: 1 });
      await expect(researcher2Session.resources.currentUser.get()).resolves.toMatchObject({ status: 'pending' });
    });
  });
});
