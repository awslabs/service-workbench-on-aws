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

describe('Update study scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Updating open data study', () => {
    it('should fail while trying to update Open Data studies by a non-admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      // This is a known Open Data study
      const studyId = '1000-genomes';

      // We need to make sure that the study id above belongs to an open data study
      const study = await adminSession.resources.studies.mustFind(studyId, 'Open Data');
      const updateBody = { rev: study.rev, description: setup.gen.description() };

      // It is unfortunate, but the current study update api returns 400 (badRequest) instead of 403 (forbidden)
      await expect(researcherSession.resources.studies.study(studyId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });
    it('should fail for anonymous user', async () => {
      // This is a known Open Data study
      const studyId = '1000-genomes';

      // We need to make sure that the study id above belongs to an open data study
      const study = await adminSession.resources.studies.mustFind(studyId, 'Open Data');
      const updateBody = { rev: study.rev, description: setup.gen.description() };

      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.studies.study(studyId).update(updateBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
