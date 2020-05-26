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

function reader(obj) {
  return key => {
    if (!_.isObject(obj)) return undefined;
    if (obj[key] && obj[key].wrapperName === 'Set') return obj[key].values;
    return obj[key];
  };
}

// This function assumes that the DocumentClient is used to do the initial unmarshalling, it
// then does the unmarshalling for client.createSet() artifact, this is because the DocumentClient unmarshales Sets
// into <my set>: { "wrapperName": "Set", "values": [ "something", ... ], "type": "String" }
function process(obj) {
  const read = reader(obj);
  const keys = Object.keys(obj);
  const result = {};
  keys.forEach(key => {
    result[key] = read(key);
  });
  return result;
}

function unmarshal(objOrArr) {
  if (objOrArr === undefined) return objOrArr;
  if (_.isArray(objOrArr)) return _.map(objOrArr, item => process(item));
  if (_.size(objOrArr) === 0) return undefined;
  return process(objOrArr);
}

module.exports = unmarshal;
