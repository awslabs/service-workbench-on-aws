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
 * contains details of the CloudFormation outputs to retrieve:
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
 * @param otherAwsRegion
 * @param currentSettings
 * @param cloudFormationSettings
 * @returns {Promise<{*}>}
 */
async function getCloudFormationCrossRegionValues(
  stage,
  awsProfile,
  otherAwsRegion,
  currentSettings,
  cloudFormationSettings,
) {
  const cf = createAwsSdkClient('CloudFormation', awsProfile, { apiVersion: '2010-05-15', region: otherAwsRegion });

  // The settings for the other CloudFormation stack will be in the other region
  const settingsForExpansion = { ...currentSettings, stage, awsRegion: otherAwsRegion };
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
