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

describe('Study files upload request scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Study files upload request', () => {
    it('should fail when inactive user tries upload files to their personal study', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'inactive-user-file-upload-test' });

      await researcherSession.resources.studies.create({ id: studyId });
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.studies
          .study(studyId)
          .uploadRequest()
          .getPresignedRequests(['dummyFile1', 'dummyFile2']),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });
  });
});
