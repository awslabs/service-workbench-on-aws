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

describe('Publish workflow templates drafts scenarios', () => {
  let setup;
  let adminSession;

  // Creates a publish request object that is ready to be used for the publish operation
  const createPublishRequest = async () => {
    const templateId = setup.gen.string({ prefix: 'wt-template-draft-test-publish' });
    const title = setup.gen.string({ prefix: 'Title publish wt-template-draft-test-publish' });
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

  describe('Publishing workflow template drafts', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const publish = await createPublishRequest();

      await expect(anonymousSession.resources.workflowTemplates.drafts().publish(publish)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      const publish = await createPublishRequest();

      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.workflowTemplates.drafts().publish(publish)).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const publish = await createPublishRequest();

      await expect(guestSession.resources.workflowTemplates.drafts().publish(publish)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const publish = await createPublishRequest();

      await expect(guestSession.resources.workflowTemplates.drafts().publish(publish)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      const publish = await createPublishRequest();

      await expect(researcherSession.resources.workflowTemplates.drafts().publish(publish)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should publish the workflow template draft if admin', async () => {
      const publish = await createPublishRequest();

      await expect(adminSession.resources.workflowTemplates.drafts().publish(publish)).resolves.toHaveProperty(
        'template.title',
        publish.template.title,
      );
    });
  });
});
