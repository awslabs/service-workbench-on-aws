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

const { runSetup } = require('../../../../support/setup');
const errorCode = require('../../../../support/utils/error-code');

describe('Migration for My Studies scenarios', () => {
  let setup;
  let adminSession;
  let targetUser;
  let targetUserSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    // Create cognito user to migrate ownership to
    targetUserSession = await setup.createResearcherSession();
    targetUser = targetUserSession.user;
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting My Studies', () => {
    it('should fail if request not by admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(researcherSession.resources.migration.listInternaAuthUserMyStudies()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return empty list if nothing to migrate', async () => {
      await expect(adminSession.resources.migration.listInternaAuthUserMyStudies()).resolves.toStrictEqual([]);
    });
  });

  describe('Migrating My Studies', () => {
    let studyId;

    it('should fail if request not by admin', async () => {
      const researcherSession = await setup.createResearcherSession();
      // Create My Study
      studyId = setup.gen.string({ prefix: `migrate-my-study-test` });
      await researcherSession.resources.studies.create({ id: studyId, name: studyId, category: 'My Studies' });

      const body = [{ studyId, uid: targetUser.uid }];
      await expect(researcherSession.resources.migration.migrateMyStudyOwnership(body)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should succeed if end user is non internal and fail on reattempt after success', async () => {
      // Create My Study
      studyId = setup.gen.string({ prefix: `migrate-my-study-test` });
      await adminSession.resources.studies.create({ id: studyId, name: studyId, category: 'My Studies' });

      const body = [{ studyId, uid: targetUser.uid }];
      const expectedContents = {
        category: 'My Studies',
        id: studyId,
        name: studyId,
      };

      await expect(adminSession.resources.migration.migrateMyStudyOwnership(body)).resolves.toMatchObject([
        expect.objectContaining(expectedContents),
      ]);
      await expect(adminSession.resources.migration.migrateMyStudyOwnership(body)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });
  });
});
