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
const axios = require('axios').default;
const UpdateStudyFixture = require('./__fixtures__/update-study-fixture');
const { getTestAdminToken } = require('../../../utils/auth-tokens');
const { listStudies } = require('../../../utils/studies');
const { updateStudyParams, getStudyParams } = require('../../../helpers/api-param-generator');

describe('Update Study Test', () => {
  let testFixture;

  beforeAll(async () => {
    testFixture = new UpdateStudyFixture();

    if (!UpdateStudyFixture.baseReady) {
      await testFixture.setupParent();
    }
    if (!UpdateStudyFixture.ready) {
      await testFixture.setupPreRequisites();
    }
  });

  describe('Update Study API', () => {
    it('should fail while trying to update Open Data studies', async () => {
      // BUILD
      const adminBearerToken = await getTestAdminToken(testFixture.testConfig);
      // This is a known Open Data study
      // but let the test admin confirm that anyway
      const studyId = '1000-genomes';
      const projectId = testFixture.testConfig.projectId;
      const openDataStudies = await listStudies(adminBearerToken, 'Open Data');
      const studyOfInterest = _.find(openDataStudies, study => study.id === studyId);
      expect(studyOfInterest.category).toBe('Open Data');

      const updateRequest = { id: studyId, description: 'Sample desc change' };
      const expectedErr = new Error('Request failed with status code 404');

      const userA = await testFixture.createNonAdminUser(adminBearerToken, projectId);
      const headers = { 'Authorization': userA.token, 'Content-Type': 'application/json' };
      const params = updateStudyParams(studyId, updateRequest);

      // EXECUTE & CHECK
      await expect(axios.put(params.api, params.body, { headers })).rejects.toThrow(expectedErr);
    });

    it("should fail while trying to update another user's personal studies", async () => {
      // BUILD
      const projectId = testFixture.testConfig.projectId;
      const adminBearerToken = await getTestAdminToken(testFixture.testConfig);
      const expectedErr = new Error('Request failed with status code 404');

      const userA = await testFixture.createNonAdminUser(adminBearerToken, projectId);
      const studyA = await testFixture.createMyStudy(userA.token, projectId);

      // UserB tries to access UserA's personal study
      const userB = await testFixture.createNonAdminUser(adminBearerToken, projectId);
      const headers = { 'Authorization': userB.token, 'Content-Type': 'application/json' };
      const params = getStudyParams(studyA.id);

      // EXECUTE & CHECK
      await expect(axios.get(params.api, { headers })).rejects.toThrow(expectedErr);
    });
  });
});
