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

// Loops through all environment variables that start with given "prefix" and
// return them all in one object map.
//
// For example, if the variable name is 'APP_AWS_REGION', and the prefix is "APP_",
// this translates into the object:
// {
//   'awsRegion': '<value>',
//    ... other key/value pairs
// }
function extract(prefix = '') {
  const object = {};
  _.forEach(process.env, (value, keyRaw = '') => {
    if (!_.startsWith(keyRaw, prefix)) return;
    const sliced = keyRaw.slice(prefix.length);
    const key = _.camelCase(sliced);
    object[key] = value;
  });

  return object;
}

module.exports = {
  extract,
};
