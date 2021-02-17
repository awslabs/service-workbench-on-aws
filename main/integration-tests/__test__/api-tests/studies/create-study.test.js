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

describe('Create study scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Creating study', () => {
    it('should fail if non-system user tries to create Open Data studies', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'inactive-user-open-data-study-test' });

      await expect(
        researcherSession.resources.studies.create({ id: studyId, category: 'Open Data' }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail when resources field is assigned to non-Open Data studies', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'inactive-user-study-resources-test' });

      await expect(
        researcherSession.resources.studies.create({ id: studyId, resources: ['dummyResourcePath'] }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail if inactive user tries to create user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'inactive-user-study-create-test' });

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.studies.create({ id: studyId })).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });
  });
});
