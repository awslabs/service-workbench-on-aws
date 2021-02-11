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
const StudyFixture = require('./__fixtures__/study-fixture');
const { listStudies } = require('../../../utils/studies');
const { updateStudyParams, getStudyParams } = require('../../../helpers/api-param-generator');

describe('Study Controller API Tests', () => {
  let testFixture;
  let testProjectId;
  let testAdmin;

  beforeAll(async () => {
    testFixture = new StudyFixture();
    await testFixture.setup();

    testProjectId = testFixture.testConfig.projectId;
    testAdmin = await testFixture.getAdminUser();
  });

  describe('Update Study API: /api/studies/:id', () => {
    it('should fail while trying to update Open Data studies', async () => {
      // BUILD
      // This is a known Open Data study
      // but let the test admin confirm that anyway
      const studyId = '1000-genomes';
      const openDataStudies = await listStudies(testAdmin.axiosClient, 'Open Data');
      const studyOfInterest = _.find(openDataStudies, study => study.id === studyId);
      expect(studyOfInterest.category).toBe('Open Data');

      const updateRequest = { id: studyId, description: 'Sample desc change' };

      const nonAdminUser = await testFixture.createNonAdminUser(testAdmin.axiosClient, testProjectId);
      const params = updateStudyParams(studyId, updateRequest);

      // EXECUTE & CHECK
      await expect(nonAdminUser.axiosClient.put(params.api, params.body)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });

    it("should fail while trying to update another user's personal studies", async () => {
      // BUILD

      const nonAdminUser = await testFixture.createNonAdminUser(testAdmin.axiosClient, testProjectId);
      const studyA = await testFixture.createMyStudy(nonAdminUser.axiosClient, testProjectId);

      // UserB tries to access nonAdminUser's personal study
      const userB = await testFixture.createNonAdminUser(testAdmin.axiosClient, testProjectId);
      const updateRequest = { id: studyA.id, description: 'Sample desc change' };
      const params = updateStudyParams(studyA.id, updateRequest);

      // EXECUTE & CHECK
      await expect(userB.axiosClient.get(params.api)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('Get Specific Study API: /api/studies/:id', () => {
    it("should fail while trying to get another user's personal studies", async () => {
      // BUILD
      const nonAdminUser = await testFixture.createNonAdminUser(testAdmin.axiosClient, testProjectId);
      const studyA = await testFixture.createMyStudy(nonAdminUser.axiosClient, testProjectId);

      // UserB tries to access nonAdminUser's personal study
      const userB = await testFixture.createNonAdminUser(testAdmin.axiosClient, testProjectId);
      const params = getStudyParams(studyA.id);

      // EXECUTE & CHECK
      await expect(userB.axiosClient.get(params.api)).rejects.toMatchObject({
        response: { status: 404 },
      });
    });
  });

  describe('POST Study for create API: /api/studies/', () => {
    it('should send back correct type for study access property', async () => {
      // EXECUTE & CHECK
      const response = await testFixture.createMyStudy(testAdmin.axiosClient, testProjectId);
      // The study creator is the admin of the study and gets back the access set accordingly
      expect(response.access).toBe(['admin']);
    });
  });
});
