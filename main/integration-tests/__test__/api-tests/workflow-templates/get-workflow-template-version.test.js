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

describe('Get a workflow templates version scenarios', () => {
  let setup;
  let adminSession;
  let templateId;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    templateId = setup.defaults.workflowTemplateId;
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting a workflow template version data', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.workflowTemplates
          .versions(templateId)
          .version(1)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.workflowTemplates
          .versions(templateId)
          .version(1)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(
        guestSession.resources.workflowTemplates
          .versions(templateId)
          .version(1)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(
        guestSession.resources.workflowTemplates
          .versions(templateId)
          .version(1)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(
        researcherSession.resources.workflowTemplates
          .versions(templateId)
          .version(1)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return the workflow template version if admin', async () => {
      await expect(
        adminSession.resources.workflowTemplates
          .versions(templateId)
          .version(1)
          .get(),
      ).resolves.toMatchObject({ id: templateId, v: 1 });
    });
  });
});
