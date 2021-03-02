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

const categoryCases = [
  ['my-study', 'My Studies'],
  ['org-study', 'Organization'],
];
describe('Get study scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe.each(categoryCases)('Getting %p', (studyPrefix, studyCategory) => {
    it('should fail if user is inactive', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-test-inactive-user` });

      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });
      await adminSession.resources.users.deactivateUser(researcherSession.user);
      await expect(researcherSession.resources.studies.study(studyId).get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is not owner', async () => {
      const researcher1session = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-test-non-owner` });

      await researcher1session.resources.studies.create({ id: studyId, category: studyCategory });
      const researcher2session = await setup.createResearcherSession();
      await expect(researcher2session.resources.studies.study(studyId).get()).rejects.toMatchObject({
        code: errorCode.http.code.notFound,
      });
    });

    it('should fail for anonymous user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: `get-${studyPrefix}-test-anon-user` });
      await researcherSession.resources.studies.create({ id: studyId, category: studyCategory });

      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.studies.study(studyId).get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
