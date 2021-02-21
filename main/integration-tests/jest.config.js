/* eslint-disable no-restricted-syntax */
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
const parse = require('yargs-parser');

const Settings = require('./support/utils/settings');
const { initAws } = require('./support/aws/init-aws');
const { getIdToken } = require('./support/utils/id-token');
const { getCallerAccountId } = require('./support/aws/utils/caller-account-id');

let settings;

async function init() {
  // jest might call the jest.config exported async function multiple times, we don't need to be doing
  // the global initialization logic multiple times.
  if (settings) return;

  const parsedArgs = parse(process.argv);

  // Get the stage argument either from the command line args or from the process environment variables
  const stage = parsedArgs.stage || parsedArgs.s || process.env.STAGE;
  if (_.isEmpty(stage)) {
    throw new Error(
      'No "stage" argument was passed. Please pass the stage name via the command line.\nThe "stage" is your yaml configuration file name (without .yml).\nExample: $ pnpm intTest -- --stage=<stage name>\n',
    );
  }

  // This runId is generated per integration tests run
  const runId = `${Date.now()}`;

  // Using the stage name, we can now load the configuration settings yaml file
  const yamlFile = path.join(__dirname, `./config/settings/${stage}.yml`);
  const yamlObject = yaml.load(await fs.readFile(yamlFile, 'utf8'));

  // We haven't finished collecting all the necessary settings, this is because not all settings
  // come from the yaml file.
  const settingsStore = new Settings({ ...yamlObject, runId });
  const aws = await initAws({ settings: settingsStore });

  // If we detect that there is a password value in the yaml file, we error out and ask the user to provide
  // the password path in parameter store instead
  const passwordInYml = settingsStore.optional('password');
  if (!_.isEmpty(passwordInYml)) {
    throw new Error(
      "Please don't provide the admin password in the yaml file. Instead store the password in the paramter store. Then, provide the path (name) of the parameter in the yaml file\n",
    );
  }

  // The api endpoint from cloudformation if not local
  let apiEndpoint;

  // If isLocal = false, we get the api endpoint from the backend stack outputs
  if (settingsStore.get('isLocal')) {
    apiEndpoint = settingsStore.get('localApiEndpoint');
  } else {
    const cloudformation = await aws.services.cloudFormation();
    const stackName = aws.settings.get('backendStackName');
    apiEndpoint = await cloudformation.getStackOutputValue(stackName, 'ServiceEndpoint');
    if (_.isEmpty(apiEndpoint)) throw new Error(`No API Endpoint value defined in stack ${stackName}`);
  }

  // Get the aws account id of the deployed solution (used as part of the global namespace)
  const awsAccountId = await getCallerAccountId({ aws });

  // Get the admin password from parameter store
  const ssm = await aws.services.parameterStore();
  const passwordPath = settingsStore.get('passwordPath');
  const password = await ssm.getParameter(passwordPath);

  const adminIdToken = await getIdToken({
    username: settingsStore.get('username'),
    password,
    apiEndpoint,
    authenticationProviderId: settingsStore.get('authenticationProviderId'),
  });

  settings = { ...settingsStore.entries, apiEndpoint, password, adminIdToken, awsAccountId };
}

// async function that returns the configuration
module.exports = async () => {
  await init();
  return {
    rootDir: __dirname,
    verbose: false,
    notify: false,
    testEnvironment: 'node',
    testTimeout: 60 * 60 * 1000,
    // testPathIgnorePatterns: [],

    // Configure JUnit reporter as CodeBuild currently only supports JUnit or Cucumber reports
    // See https://docs.aws.amazon.com/codebuild/latest/userguide/test-reporting.html
    reporters: ['default', ['jest-junit', { suiteName: 'jest tests', outputDirectory: './.build/test' }]],
    globals: {
      __settings__: settings,
    },
  };
};
