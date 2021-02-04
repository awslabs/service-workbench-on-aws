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
const { getInternalUserToken } = require('../../../../utils/auth-tokens');
const { createStudyJson, createStudy } = require('../../../../utils/studies');
const { createUserJson, createUser } = require('../../../../utils/users');

// Test Fixture
/**
 * This class is designed to pre-generate & help generate (using methods) resources
 * that would be required by a SPECIFIC integration test suite
 *
 * The verification of these components are performed once every respective test suite cycle
 * For example, whenever update-study-api test suite is triggered
 */
class UpdateStudyFixture extends BaseFixture {
  constructor() {
    super();
    // This static property keeps track of whether or not its parent needs a check
    // since parent may be different than BaseFixture
    UpdateStudyFixture.baseReady = BaseFixture.ready;

    // We initially assume the Test Fixture is not verified
    // For this to turn true, we need to confirm the test pre-requisites are valid
    UpdateStudyFixture.ready = false;
  }

  async setupParent() {
    await this.setupBasePreRequisites();
    UpdateStudyFixture.baseReady = true;
  }

  // IMPORTANT: These will be created afresh every new integration test cycle
  // Create and add pre-requisite resources here as needed
  async setupPreRequisites() {
    // We currently only need helper methods to assist tests in the update-study test suite
    // Since we don't have any pre-requisite resources needed, set this to true
    UpdateStudyFixture.ready = true;
  }

  async createNonAdminUser(bearerToken, projectId) {
    const testName = 'UpdateStudy';
    const nonAdminUserJson = createUserJson({ projId: projectId, testName });
    const response = await createUser(bearerToken, nonAdminUserJson);
    const userToken = await getInternalUserToken(nonAdminUserJson.username, nonAdminUserJson.password);

    return { ...response, password: nonAdminUserJson.password, token: userToken };
  }

  async createMyStudy(bearerToken, projectId) {
    const testName = 'UpdateStudy';
    const studyToCreate = createStudyJson({ projectId, testName });
    const study = await createStudy(bearerToken, studyToCreate);
    return study;
  }
}

module.exports = UpdateStudyFixture;
