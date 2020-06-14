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

const { createAwsSdkClient } = require('./utils');

const settingRegexp = /\$\{([:._-\w]+)\}/g;

/**
 * Expands serverless settings in a string. It supports recursive lookups and path-based lookup
 * with a maximum path length of two items.
 *
 * Example:
 * ```javascript
 * const env = { greeting: {welcome: 'hello', goodbye: 'bye}, intro: 'welcome', target: '${self:custom.settings.greeting.${self:custom.settings.intro}}' };
 * substitute(env)('${self:custom.settings.target}-world'); // outputs: 'hello-world'
 * ```
 *
 * @param {object} env an environment object containing keys and string values or an object containing string values.
 * @throws if a variable is missing in the environment.
 */
const settingExpander = settings => {
  const replacer = (input, limit = 4) => {
    if (limit <= 0) {
      return input;
    }
    const result = input.replace(settingRegexp, (_, braced) => {
      const splitChar = braced.includes('.') ? '.' : ':';
      const parts = braced.split(splitChar);
      const key = parts[parts.length - 1];
      if (key in settings && typeof settings[key] !== 'object') {
        return settings[key];
      }

      // For now just support path lengths for the lookup of up to two
      if (parts.length > 1) {
        const nestedKey = parts[parts.length - 2];
        if (nestedKey in settings) {
          return settings[nestedKey][key];
        }
      }
      throw new Error('Failed to expand input - either not found or the settings path length is > 2');
    });

    return result.match(settingRegexp) ? replacer(result, limit - 1) : result;
  };

  return replacer;
};

/**
 * A function to get cross region CloudFormation outputs. The cloudFormationSettings parameter
 * contains details of the CloudFormation outputs to retrieve, and the targetAwsRegion is the
 * region from which those outputs will be pulled:
 *
 * {
 *   ServerlessSettingWithStackName: [{
 *    settingName: 'nameOfServerlessSetting',
 *    outputKey: "StackOutputName"
 *  }]
 * }
 *
 * The name of the stack is resolved from the current settings. The stack outputs are retrieved
 * and the desired output is merged into the serverless settings with the desired name.
 *
 * @param stage
 * @param awsProfile
 * @param targetAwsRegion
 * @param currentSettings
 * @param cloudFormationSettings
 * @returns {Promise<{*}>}
 */
async function getCloudFormationCrossRegionValues(
  stage,
  awsProfile,
  targetAwsRegion,
  currentSettings,
  cloudFormationSettings,
) {
  const cf = createAwsSdkClient('CloudFormation', awsProfile, { apiVersion: '2010-05-15', region: targetAwsRegion });

  // Pull in CloudFormation output values from the target region
  const settingsForExpansion = { ...currentSettings, stage, awsRegion: targetAwsRegion };
  const expander = settingExpander(settingsForExpansion);

  const results = await Promise.all(
    Object.entries(cloudFormationSettings).map(async ([stackSettingNameKey, cfVariables]) => {
      const StackName = expander(currentSettings[stackSettingNameKey]);
      const result = await cf.describeStacks({ StackName }).promise();
      const {
        Stacks: [{ Outputs }],
      } = result;

      const settingsToMerge = cfVariables.reduce((previous, { settingName, outputKey }) => {
        const setting = Outputs.find(({ OutputKey }) => OutputKey === outputKey);
        return { ...previous, [settingName]: setting.OutputValue };
      }, {});

      return settingsToMerge;
    }),
  );

  return results.reduce((previous, current) => ({ ...previous, ...current }), {});
}
exports.getCloudFormationCrossRegionValues = getCloudFormationCrossRegionValues;
