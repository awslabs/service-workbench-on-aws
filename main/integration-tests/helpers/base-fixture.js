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

const fs = require('fs');
const _ = require('lodash');
const YAML = require('js-yaml');
const { getProjectParams } = require('./api-param-generator');
const { listUsers } = require('../utils/users');
const { getTestAdminClient } = require('../utils/auth-tokens');

// Since the settings for integration test are not passed on similar to serverless variables in the
// rest of the SDCs, we import the file directly according to the stage specified
const TEST_CONFIG_PATH = `../integration-tests/config/settings/${process.env.ENV_NAME}.yml`;

// Base Fixture
/**
 * This class is designed to generate resources that would be required for any integration test to work
 * For example, if the user provided invalid test admin credentials, none of the test resources would be created in the tests
 *
 * The verification of such critical components are performed only once at the start of every integration test cycle
 */
class BaseFixture {
  constructor() {
    this.testConfig = fs.existsSync(TEST_CONFIG_PATH) ? YAML.load(fs.readFileSync(TEST_CONFIG_PATH, 'utf8')) : {};

    // We initially assume the Base Fixture is not verified
    // For this to turn true, we need to confirm the test admin credentials and provided test project ID are valid
    BaseFixture.ready = false;
  }

  async setupBasePreRequisites() {
    try {
      const testAdminVerified = await this.verifyTestAdmin();
      const projectVerified = await this.verifyTestProject();

      if (projectVerified && testAdminVerified) BaseFixture.ready = true;
    } catch (err) {
      throw new Error(`There was a problem verifying base fixture resources: ${err}`);
    }
  }

  // Check if TestAdmin is actually admin
  async verifyTestAdmin() {
    const axiosClient = await getTestAdminClient(this.testConfig);
    const allUsers = await listUsers(axiosClient);
    const userOfInterest = _.find(allUsers, user => user.username === this.testConfig.username);
    return userOfInterest.isAdmin;
  }

  async verifyTestProject() {
    const params = getProjectParams(this.testConfig.projectId);
    const axiosClient = await getTestAdminClient(this.testConfig);
    const response = await axiosClient.get(params.api);
    return !(_.isUndefined(response) || _.isEmpty(response));
  }
}

module.exports = BaseFixture;
