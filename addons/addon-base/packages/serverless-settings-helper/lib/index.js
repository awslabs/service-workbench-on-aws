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

const path = require('path');
const fs = require('fs');

const { getAwsAccountInfo } = require('./aws-acc-context');
const { getCloudFormationCrossRegionValues } = require('./cloud-formation-cross-region-values');

/**
 * Expands environment variables in a string.
 * Use `\$` to escape an otherwise valid substitution expression.
 *
 * Example:
 * ```javascript
 * const env = { greeting: 'hello', target: 'world', escaped: 'didnotreplace' };
 * substitute(env)('$greeting, ${target}, \\${escaped}, ${notfound}'); // outputs: 'hello, world, ${escaped}, ${notfound}'
 * ```
 *
 * @param {object} env an environment object containing keys and string values.
 * @throws if a variable is missing in the environment.
 */
const newExpander = (env = process.env) => s =>
  s.replace(/\\(\$)|\$([_\w]+)|\$\{([_\w]+)\}/g, (_, $, plain, braced) => {
    if ($) {
      return $;
    }
    const key = plain || braced;
    const got = env[key];
    if (typeof got === 'undefined') {
      throw new Error(`missing substitution: ${JSON.stringify(key)}`);
    }
    return got;
  });

/**
 * @returns true if a file consists of only blank lines, or if the file is a YAML file that consists of only blank lines and comments.
 */
const isEmptyFile = filename => {
  const text = fs
    .readFileSync(filename)
    .toString()
    .trim();
  if (text) {
    const ext = path.extname(filename);
    if (ext === '.yml' || ext === '.yaml') {
      const hasContent = text.split(/\r?\n/g).some(x => x.trim() && !x.trim().startsWith('#'));
      return !hasContent;
    }
    return false;
  }
  return true;
};

/**
 * @param {*} serverless a serverless object.
 * @param {object} options options to pass to the loader.
 * @param {boolean|'warn'} options.missingFiles indicates whether missing files are permissible.
 * @param {boolean|'warn'} options.emptyFiles indicates whether empty files are permissible.
 */
const newFileLoader = (serverless, options = {}) => async filename => {
  const { missingFiles = true, emptyFiles = true } = options;
  if (missingFiles && !fs.existsSync(filename)) {
    if (missingFiles === 'warn') {
      console.warn(`WARNING: missing settings file: ${filename}`); // eslint-disable-line no-console
    }
    return {};
  }
  try {
    return await serverless.yamlParser.parse(filename);
  } catch (err) {
    // The following is a kludge to support allowing empty settings files.
    // serverless.yamlParser will throw an exception if the file is empty.
    // Check if this is the case and return an empty object instead.
    if (emptyFiles && isEmptyFile(filename)) {
      if (emptyFiles === 'warn') {
        console.warn(`WARNING: empty settings file: ${filename}`); // eslint-disable-line no-console
      }
      return {};
    }
    throw err;
  }
};

module.exports = {
  /**
   * Usage example:
   *
   * In `./settings/.settings.js`:
   *
   * ```javascript
   * module.exports.merged = require('serverless-settings-helper').mergeSettings(
   *   // current working directory for resolving relative paths
   *   __dirname,
   *   // list of YAML or JSON files to require and merge
   *   [
   *     '../../global-settings.yml',
   *     './local-defaults.yml',
   *     './some-other-settings.json',
   *     './${stage}.yml',
   *   ],
   * )
   * ```
   *
   * In `./serverless.yml`:
   *
   * ```yaml
   * custom:
   *   mySettings: ${file(./settings/.settings.js):merged}
   * ```
   *
   *
   * @param {string} cwd the current working directory for resolving settings file paths.
   * @param {string[]} files a list of files to merge.
   * @param {*} options
   * @param {boolean|"warn"} options.missingFiles allow missing files.
   * @param {boolean|"warn"} options.emptyFiles allow empty files.
   */
  mergeSettings: (
    cwd,
    files,
    { missingFiles = true, emptyFiles = true, crossRegionCloudFormation } = {},
  ) => async serverless => {
    const stage = serverless.variables.options.s || serverless.variables.options.stage || undefined;
    const loadFile = newFileLoader(serverless, { missingFiles, emptyFiles });
    const expandVariables = newExpander({ stage });
    const resolvePath = filename => path.resolve(cwd, filename);
    const objects = await Promise.all(
      files
        .map(expandVariables)
        .map(resolvePath)
        .map(loadFile),
    );
    const merged = Object.assign({}, ...objects);
    const mergedSettingsObj =
      Object.keys(merged).length === 0
        ? { __suppressValidFileWarning: true } // prevents serverless from complaining about an empty object.
        : merged;

    const { awsProfile, awsRegion } = mergedSettingsObj;

    // Adding AWS Account Context
    mergedSettingsObj.awsAccountInfo = await getAwsAccountInfo(awsProfile, awsRegion);

    // Enrich settings with any cross region variables
    // But only if the user has supplied the otherAwsRegion setting
    if (crossRegionCloudFormation && 'otherAwsRegion' in mergedSettingsObj) {
      const { otherAwsRegion } = mergedSettingsObj;
      const crossRegionSettings = await getCloudFormationCrossRegionValues(
        stage,
        awsProfile,
        otherAwsRegion,
        mergedSettingsObj,
        crossRegionCloudFormation,
      );
      Object.assign(mergedSettingsObj, crossRegionSettings);
    }

    return mergedSettingsObj;
  },
};
