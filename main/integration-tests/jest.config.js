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
const path = require('path');
const fs = require('fs-extra');
const yaml = require('js-yaml');

const { getIdToken } = require('./support/utils/id-token');

let settings;

async function init() {
  // jest might call the jest.config exported async function multiple times, we don't need to be doing
  // the global initialization logic multiple times.
  if (settings) return;

  // TODO - have env name come from the yaml file
  const yamlFile = path.join(__dirname, `./config/settings/${process.env.ENV_NAME}.yml`);
  const yamlObject = yaml.load(await fs.readFile(yamlFile, 'utf8'));

  const envName = process.env.ENV_NAME;
  // TODO - get the api endpoint from cloudformation
  const apiEndpoint = yamlObject.isLocal ? yamlObject.localApiEndpoint : process.env.API_ENDPOINT;
  if (_.isEmpty(apiEndpoint)) throw Error(`Please provide API_ENDPOINT as an environment variable`);

  const runId = `${Date.now()}`;
  // TODO - get the password from parameter store
  const adminIdToken = await getIdToken({
    username: yamlObject.username,
    password: yamlObject.password, // TODO - get it from the parameter store
    apiEndpoint,
    authenticationProviderId: yamlObject.authenticationProviderId,
  });

  settings = { ...yamlObject, envName, apiEndpoint, runId, adminIdToken };
}

// async function that returns the configuration
module.exports = async () => {
  await init();
  return {
    rootDir: __dirname,
    verbose: false,
    notify: false,
    testEnvironment: 'node',
    // testPathIgnorePatterns: [],

    // Configure JUnit reporter as CodeBuild currently only supports JUnit or Cucumber reports
    // See https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html
    reporters: ['default', ['jest-junit', { suiteName: 'jest tests', outputDirectory: './.build/test' }]],
    globals: {
      __settings__: settings,
    },
  };
};
