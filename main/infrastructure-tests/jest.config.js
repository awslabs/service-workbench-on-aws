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

async function init() {
  const parsedArgs = parse(process.argv);

  // Get the stage argument either from the command line args or from the process environment variables
  const stage = parsedArgs.stage || parsedArgs.s || process.env.STAGE;
  if (_.isEmpty(stage)) {
    throw new Error(
      'No "stage" argument was passed. Please pass the stage name via the command line.\nThe "stage" is your yaml configuration file name (without .yml).\nExample: $ pnpm testAppStreamEgressEnabled -- --stage=<stage name>\n',
    );
  }
  // Using the stage name, we can now load the configuration settings yaml file
  const yamlFile = path.join(__dirname, `./config/settings/${stage}.yml`);
  return yaml.load(await fs.readFile(yamlFile, 'utf8'));
}

// async function that returns the configuration
module.exports = async () => {
  const settings = await init();
  return {
    rootDir: __dirname,
    verbose: false,
    notify: false,
    testEnvironment: 'node',
    testTimeout: 60 * 60 * 1000,
    globals: {
      __settings__: settings,
    },
  };
};
