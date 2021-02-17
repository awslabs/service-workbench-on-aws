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

describe('Get study permissions scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Get study permissions', () => {
    it('should fail if inactive user tries to get study permissions', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'inactive-user-study-perm-test' });
      await researcherSession.resources.studies.create({ id: studyId });
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if a user tries to get permissions of a study for which they are not the admin', async () => {
      const researcher1Session = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'non-study-admin-user-perm-test' });
      await researcher1Session.resources.studies.create({ id: studyId });

      // This user is brand new and does not have any permissions to [studyId] yet
      const researcher2Session = await setup.createResearcherSession();

      await expect(
        researcher2Session.resources.studies
          .study(studyId)
          .permissions()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.notFound,
      });
    });
  });
});
