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

describe('List study files scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Listing study files', () => {
    it('should return an empty list while trying to get files of a newly created study', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'empty-files-test' });

      // Newly created study which does not have any files associated
      await researcherSession.resources.studies.create({ id: studyId });

      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).resolves.toStrictEqual([]);
    });

    it('should fail when inactive user tries get files of a study', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'empty-files-test' });

      // Newly created study which does not have any files associated
      await researcherSession.resources.studies.create({ id: studyId });

      await adminSession.resources.users.deactivateUser(researcherSession.user);
      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .files()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });
  });
});
