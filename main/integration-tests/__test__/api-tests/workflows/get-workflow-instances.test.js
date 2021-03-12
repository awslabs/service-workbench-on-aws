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

const _ = require('lodash');

const { runSetup } = require('../../../support/setup');
const errorCode = require('../../../support/utils/error-code');

describe('Get workflow instances scenarios', () => {
  let setup;
  let adminSession;
  let workflow;
  let instanceId;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    const workflowId = setup.gen.string({ prefix: 'get-wf-instances-test' });
    workflow = await adminSession.resources.workflows.versions(workflowId).create();

    // We trigger the workflow so that we can create an instance. There is no direct API
    // to create a workflow instance other than triggering a workflow
    const triggerInfo = await adminSession.resources.workflows
      .versions(workflow.id)
      .version(workflow.v)
      .triggerAndWait();

    instanceId = _.get(triggerInfo, 'instance.id');
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting workflow instances', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();

      // To test returning all the instances
      await expect(
        anonymousSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });

      // To test returning a specific instance
      await expect(
        anonymousSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .instance(instanceId)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const admin2Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin2Session.user);

      // To test returning all the instances
      await expect(
        admin2Session.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });

      // To test returning a specific instance
      await expect(
        admin2Session.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .instance(instanceId)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      // To test returning all the instances
      await expect(
        guestSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning a specific instance
      await expect(
        guestSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .instance(instanceId)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });

      // To test returning all the instances
      await expect(
        guestSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });

      // To test returning a specific instance
      await expect(
        guestSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .instance(instanceId)
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for researcher', async () => {
      const researcherSession = await setup.createResearcherSession();

      // To test returning all the instances
      await expect(
        researcherSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .get(),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return workflow instances for admin', async () => {
      // To test returning all the instances
      await expect(
        adminSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .get(),
      ).resolves.toMatchObject(expect.arrayContaining([expect.objectContaining({ id: instanceId })]));

      // To test returning a specific instance
      await expect(
        adminSession.resources.workflows
          .versions(workflow.id)
          .version(workflow.v)
          .instances()
          .instance(instanceId)
          .get(),
      ).resolves.toMatchObject({ id: instanceId, wfId: workflow.id, wfVer: workflow.v });
    });
  });
});
