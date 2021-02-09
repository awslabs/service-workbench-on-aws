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
const { getUser } = require('../utils/users');
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
  }

  /**
   * Override this method to include your initialization code, but also run super.setup() to ensure parent is initialized.
   * Keep in mind that this method is async.
   */
  async setup() {
    // If a test config file was not found at all, we cannot run integration tests
    if (_.isEmpty(this.testConfig)) {
      throw new Error('Test configuration is not set up correctly');
    }
    try {
      const testAdminVerified = await this.verifyTestAdmin();
      const projectVerified = await this.verifyTestProject();

      if (!projectVerified || !testAdminVerified)
        throw new Error(
          'Please make sure testAdmin credentials are for an "admin" level user, and the projectId provided actually exists',
        );
    } catch (err) {
      throw new Error(`There was a problem verifying base fixture resources: ${err}`);
    }
  }

  async getAdminUser() {
    const adminClient = await getTestAdminClient(this.testConfig);
    const response = await getUser(adminClient);
    return { ...response, password: this.testConfig.password, axiosClient: adminClient };
  }

  // Check if TestAdmin is actually admin
  async verifyTestAdmin() {
    const axiosClient = await getTestAdminClient(this.testConfig);
    const user = await getUser(axiosClient);
    return user.isAdmin;
  }

  async verifyTestProject() {
    const params = getProjectParams(this.testConfig.projectId);
    const axiosClient = await getTestAdminClient(this.testConfig);
    const response = await axiosClient.get(params.api);
    return !(_.isUndefined(response) || _.isEmpty(response));
  }
}

module.exports = BaseFixture;
