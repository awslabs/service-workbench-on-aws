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
const UpdateStudyFixture = require('./__fixtures__/update-study-fixture');
const { listStudies } = require('../../../utils/studies');
const { updateStudyParams, getStudyParams } = require('../../../helpers/api-param-generator');

describe('Update Study Test', () => {
  let testFixture;

  beforeAll(async () => {
    testFixture = new UpdateStudyFixture();
    await testFixture.setup();
  });

  describe('Update Study API', () => {
    it('should fail while trying to update Open Data studies', async () => {
      // BUILD
      const adminUser = await testFixture.getAdminUser();
      // This is a known Open Data study
      // but let the test admin confirm that anyway
      const studyId = '1000-genomes';
      const projectId = testFixture.testConfig.projectId;
      const openDataStudies = await listStudies(adminUser.axiosClient, 'Open Data');
      const studyOfInterest = _.find(openDataStudies, study => study.id === studyId);
      expect(studyOfInterest.category).toBe('Open Data');

      const updateRequest = { id: studyId, description: 'Sample desc change' };

      const nonAdminUser = await testFixture.createNonAdminUser(adminUser.axiosClient, projectId);
      const params = updateStudyParams(studyId, updateRequest);

      // EXECUTE & CHECK
      await expect(nonAdminUser.axiosClient.put(params.api, params.body)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it("should fail while trying to update another user's personal studies", async () => {
      // BUILD
      const projectId = testFixture.testConfig.projectId;
      const adminUser = await testFixture.getAdminUser();

      const nonAdminUser = await testFixture.createNonAdminUser(adminUser.axiosClient, projectId);
      const studyA = await testFixture.createMyStudy(nonAdminUser.axiosClient, projectId);

      // UserB tries to access nonAdminUser's personal study
      const userB = await testFixture.createNonAdminUser(adminUser.axiosClient, projectId);
      const params = getStudyParams(studyA.id);

      // EXECUTE & CHECK
      await expect(userB.axiosClient.get(params.api)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });
});
