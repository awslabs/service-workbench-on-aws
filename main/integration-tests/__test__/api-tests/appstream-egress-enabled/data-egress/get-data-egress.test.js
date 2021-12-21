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
  const emptyEgressEnvId = '690b4eb6-c04e-4771-b0c5-1f1656738e89';
  const nonEmptyEgressEnvId = 'ea8e5286-45ca-402a-8c98-7d4495f646e2';

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
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

      // OPERATE
      const retVal = await adminSession.resources.dataEgresses.dataEgress(emptyEgressEnvId).get();

      // CHECK
      expect(retVal).toStrictEqual(expected);
    });

    it('should return Egress data for non-empty egress folder', async () => {
      // BUILD
      const expected = {
        objectList: [
          {
            Key: 'test.txt',
            LastModified: '2021-08-26T18:06:02.000Z',
            ETag: '"0df0f2b1ae20b285e0f2852b3b968e8a"',
            Size: '39 Bytes',
            StorageClass: 'STANDARD',
            projectId: 'TRE-Project',
            workspaceId: 'ea8e5286-45ca-402a-8c98-7d4495f646e2',
          },
        ],
        isAbleToSubmitEgressRequest: false,
      };

      // OPERATE
      const retVal = await adminSession.resources.dataEgresses.dataEgress(nonEmptyEgressEnvId).get();

      // CHECK
      expect(retVal).toStrictEqual(expected);
    });
  });
});
