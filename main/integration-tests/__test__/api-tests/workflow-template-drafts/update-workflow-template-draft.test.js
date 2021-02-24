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

describe('Update workflow templates drafts scenarios', () => {
  let setup;
  let adminSession;

  // Creates an update request object that is ready to be used for the update operation
  const createUpdateRequest = async () => {
    const templateId = setup.gen.string({ prefix: 'wt-template-draft-test-update' });
    const title = setup.gen.string({ prefix: 'Title updated wt-template-draft-test-update' });
    const draft = await adminSession.resources.workflowTemplates.drafts().create({ templateId });

    return {
      id: draft.id,
      template: { id: draft.template.id, v: draft.template.v, propsOverrideOption: {}, selectedSteps: [], title },
    };
  };

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Updating workflow template drafts', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const update = await createUpdateRequest();

      await expect(
        anonymousSession.resources.workflowTemplates
          .drafts()
          .draft(update.id)
          .update(update),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const update = await createUpdateRequest();

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.workflowTemplates
          .drafts()
          .draft(update.id)
          .update(update),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const update = await createUpdateRequest();

      await expect(
        guestSession.resources.workflowTemplates
          .drafts()
          .draft(update.id)
          .update(update),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const update = await createUpdateRequest();

      await expect(
        guestSession.resources.workflowTemplates
          .drafts()
          .draft(update.id)
          .update(update),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const update = await createUpdateRequest();

      await expect(
        researcherSession.resources.workflowTemplates
          .drafts()
          .draft(update.id)
          .update(update),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should update the workflow template drafts if admin', async () => {
      const update = await createUpdateRequest();

      await expect(
        adminSession.resources.workflowTemplates
          .drafts()
          .draft(update.id)
          .update(update),
      ).resolves.toHaveProperty('template.title', update.template.title);
    });
  });
});
