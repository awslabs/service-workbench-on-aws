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

const BaseFixture = require('../../../../helpers/base-fixture');
const { getInternalUserClient } = require('../../../../utils/auth-tokens');
const { buildStudyJson, createStudy } = require('../../../../utils/studies');
const { buildUserJson, createUser } = require('../../../../utils/users');

// Test Fixture
/**
 * This class is designed to pre-generate & help generate (using methods) resources
 * that would be required by a SPECIFIC integration test suite
 *
 * The verification of these components are performed once every respective test suite cycle
 * For example, whenever update-study-api test suite is triggered
 */
class UpdateStudyFixture extends BaseFixture {
  // IMPORTANT: These will be created afresh every new integration test cycle
  async setup() {
    // Create and add pre-requisite resources here as needed
    // We currently only need helper methods to assist tests in the update-study test suite
    // Since we don't have any pre-requisite resources needed, set this to true
    await super.setup();
  }

  async createNonAdminUser(axiosClient, projectId) {
    const testName = 'UpdateStudy';
    const nonAdminUserJson = buildUserJson({ projId: projectId, testName });
    const response = await createUser(axiosClient, nonAdminUserJson);
    const newUserClient = await getInternalUserClient(nonAdminUserJson.username, nonAdminUserJson.password);

    return { ...response, password: nonAdminUserJson.password, axiosClient: newUserClient };
  }

  async createMyStudy(axiosClient, projectId) {
    const testName = 'UpdateStudy';
    const studyToCreate = buildStudyJson({ projectId, testName });
    const study = await createStudy(axiosClient, studyToCreate);
    return study;
  }
}

module.exports = UpdateStudyFixture;
