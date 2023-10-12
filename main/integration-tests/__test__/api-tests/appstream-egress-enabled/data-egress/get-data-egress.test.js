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
  let emptyEgressEnvId;
  let nonEmptyEgressEnvId;
  let projectId;
  let egressBucketName;

  beforeAll(async () => {
    setup = await runSetup();
    const defaults = await setup.getDefaults();
    nonEmptyEgressEnvId = defaults.linuxEnvId;
    emptyEgressEnvId = defaults.sagemakerEnvId;
    projectId = defaults.project.id;
    adminSession = await setup.defaultAdminSession();
    egressBucketName = defaults.egressBucketName;
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  // These tests assume workspaces have already been created in the SWB environment
  // TODO: Create a new workspace during these tests, and terminate once done (dependent on GALI-1093)
  describe('Get Egress Data', () => {
    it('should fail for anonymous user', async () => {
      // BUILD
      const anonymousSession = await setup.createAnonymousSession();

      // OPERATE & CHECK
      await expect(anonymousSession.resources.dataEgresses.dataEgress(emptyEgressEnvId).get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should return Egress data for empty egress folder', async () => {
      // BUILD
      const expected = {
        objectList: [],
        isAbleToSubmitEgressRequest: true,
      };
      // set isAbleToSubmitEgressRequest flag to true
      await adminSession.resources.dataEgresses.notify().activateEgressRequest(emptyEgressEnvId);

      // OPERATE
      const retVal = await adminSession.resources.dataEgresses.dataEgress(emptyEgressEnvId).get();

      // CHECK
      expect(retVal).toStrictEqual(expected);
    });

    it('should return Egress data for non-empty egress folder', async () => {
      // this is assumed that the notify egress test ran before this one
      // BUILD
      // put the text file in the egress folder
      const S3data = await adminSession.resources.dataEgresses
        .dataEgress(nonEmptyEgressEnvId)
        .putTestTxtFileInS3(egressBucketName, nonEmptyEgressEnvId);

      const expectedObject = { ...S3data, projectId };

      const expected = {
        objectList: [expectedObject],
        isAbleToSubmitEgressRequest: false,
      };

      // OPERATE
      const retVal = await adminSession.resources.dataEgresses.dataEgress(nonEmptyEgressEnvId).get();
      delete retVal.objectList[0].LastModified;
      delete retVal.objectList[0].Size;

      // CHECK
      expect(retVal).toStrictEqual(expected);

      // CLEANUP
      await adminSession.resources.dataEgresses
        .dataEgress(nonEmptyEgressEnvId)
        .deleteTestTxtFileInS3(egressBucketName, nonEmptyEgressEnvId);
    });
  });
});
