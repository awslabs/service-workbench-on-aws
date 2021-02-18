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

describe('Update current user scenarios', () => {
  let setup;

  beforeAll(async () => {
    setup = await runSetup();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('updating current user', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.currentUser.update({ rev: 0 })).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should update current user regardless of the uid in request body', async () => {
      const researcher1Session = await setup.createResearcherSession();
      const researcher2Session = await setup.createResearcherSession();
      const researcher2Info = await researcher2Session.resources.currentUser.get();
      const researcher1Info = await researcher1Session.resources.currentUser.get();
      await expect(
        researcher1Session.resources.currentUser.update({ uid: researcher2Info.uid, rev: 0, status: 'pending' }),
      ).resolves.toEqual(expect.objectContaining({ uid: researcher1Info.uid }));
    });

    it.each([{ isSamlAuthenticatedUser: true }, { isAdmin: true }, { userRole: 'admin' }])(
      'should fail if non-admin user update restrictive field %a',
      async a => {
        const researcherSession = await setup.createResearcherSession();
        await expect(researcherSession.resources.currentUser.update({ rev: 0, ...a })).rejects.toMatchObject({
          code: errorCode.http.code.forbidden,
        });
      },
    );

    it('should not allow admin elevate to root', async () => {
      const admin2Session = await setup.createAdminSession();
      await expect(admin2Session.resources.currentUser.update({ rev: 0, userRole: 'root' })).rejects.toMatchObject({
        code: errorCode.http.code.notFound,
      });
    });

    it('should not allow inactive user to become active', async () => {
      const researcherSession = await setup.createResearcherSession();
      await researcherSession.resources.currentUser.update({ rev: 0, status: 'inactive' });
      await expect(researcherSession.resources.currentUser.update({ rev: 1, status: 'active' })).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    // Note: This use-case is for federated user self-registration
    it('should allow inactive user to become pending', async () => {
      const researcherSession = await setup.createResearcherSession();
      await researcherSession.resources.currentUser.update({ rev: 0, status: 'inactive' });
      await expect(
        researcherSession.resources.currentUser.update({ rev: 1, status: 'pending' }),
      ).resolves.toMatchObject({
        status: 'pending',
      });
    });

    it('should update successfully', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(
        researcherSession.resources.currentUser.update({ rev: 0, firstName: 'John', lastName: 'Snow' }),
      ).resolves.toMatchObject({
        firstName: 'John',
        lastName: 'Snow',
        rev: 1,
      });
    });
  });
});
