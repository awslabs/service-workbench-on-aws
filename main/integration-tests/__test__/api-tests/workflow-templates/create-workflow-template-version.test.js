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

describe('Create workflow template versions scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Creating a workflow template version', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const templateId = setup.gen.string({ prefix: 'wt-template-test-create' });

      await expect(anonymousSession.resources.workflowTemplates.versions(templateId).create()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const templateId = setup.gen.string({ prefix: 'wt-template-test-create' });

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.workflowTemplates.versions(templateId).create()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const templateId = setup.gen.string({ prefix: 'wt-template-test-create' });

      await expect(guestSession.resources.workflowTemplates.versions(templateId).create()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(guestSession.resources.workflowTemplates.versions().create()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const templateId = setup.gen.string({ prefix: 'wt-template-test-create' });

      await expect(researcherSession.resources.workflowTemplates.versions(templateId).create()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return workflow template version if admin', async () => {
      const admin2Session = await setup.createAdminSession();
      const templateId = setup.gen.string({ prefix: 'wt-template-test-create' });

      await expect(admin2Session.resources.workflowTemplates.versions(templateId).create()).resolves.toHaveProperty(
        'id',
        templateId,
      );
    });
  });
});
