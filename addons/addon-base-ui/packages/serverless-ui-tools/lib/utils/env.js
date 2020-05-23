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

// Convert from {'REACT_APP_FOO': 'bar'} to REACT_APP_FOO=bar
const toLines = map => {
  // Filter out nested objects
  const flatMap = _.pickBy(map, v => !_.isObject(v));
  // Convert to key-value pairs
  const lines = _.map(flatMap, (value, key) => `${key}=${value}`);
  // Separate by newlines
  return lines.join('\n');
};

module.exports = { toLines };
