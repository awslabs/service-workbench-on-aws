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

describe('Create URL scenarios', () => {
  let setup;
  let adminSession;
  let nonEmptyEgressEnvId;
  let egressBucketName;
  let projectId;

  beforeAll(async () => {
    setup = await runSetup();
    const defaults = await setup.getDefaults();
    egressBucketName = defaults.egressBucketName;
    nonEmptyEgressEnvId = defaults.linuxEnvId;
    projectId = defaults.project.id;
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  // These tests assume workspaces have already been created in the SWB environment
  // TODO: Create a new workspace during these tests, and terminate once done (dependent on GALI-1093)
  describe('Notify Egress Data', () => {
    it('should fail for anonymous user', async () => {
      // BUILD
      const anonymousSession = await setup.createAnonymousSession();
      const body = { id: nonEmptyEgressEnvId };

      // OPERATE & CHECK
      await expect(anonymousSession.resources.dataEgresses.notify().create(body)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should notify Egress data', async () => {
      // BUILD
      const body = { id: nonEmptyEgressEnvId };
      const expected = {
        egress_store_id: nonEmptyEgressEnvId,
        egress_store_name: 'AppStream-Egress-Linux-egress-store',
        project_id: projectId,
        s3_bucketname: egressBucketName,
        s3_bucketpath: `${nonEmptyEgressEnvId}/`,
        status: 'PENDING',
        workspace_id: nonEmptyEgressEnvId,
      };
      // set isAbleToSubmitEgressRequest flag to true
      await adminSession.resources.dataEgresses.notify().activateEgressRequest(nonEmptyEgressEnvId);

      // OPERATE
      const result = await adminSession.resources.dataEgresses.notify().create(body);

      // CHECK
      expect(result).toMatchObject(expected);
    });
  });
});
