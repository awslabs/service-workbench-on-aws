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

async function cfnOutputsToConnections(outputs) {
  // Using Map instead of object to preserve order
  const connectionsMap = new Map();
  _.forEach(outputs, output => {
    const regex = /MetaConnection([0-9]+)?(.+)/;
    // Parse the output key
    //    'MetaConnection1Name' => ["MetaConnection1Name", "1", "Name"]
    //    'MetaConnectionName' => ["MetaConnectionName", undefined, "Name"]
    //    'some-output-not-matching' => null
    const parsedOutput = output.OutputKey.match(regex);
    if (parsedOutput && _.isArray(parsedOutput) && parsedOutput.length === 3) {
      const connectionIdx = parsedOutput[1] || 0;
      const connectionId = `id-${connectionIdx}`;
      let connection = connectionsMap.get(connectionId);
      if (!connection) {
        connection = {};
        connectionsMap.set(connectionId, connection);
      }
      connection[_.camelCase(parsedOutput[2])] = output.OutputValue;
      connection.id = connectionId;
    }
  });

  const result = [];
  // converting map to result array
  connectionsMap.forEach(value => result.push(value));

  return result;
}

function cfnOutputsArrayToObject(outputs) {
  const outputsObject = {};
  _.forEach(outputs, output => {
    _.set(outputsObject, output.OutputKey, output.OutputValue);
  });
  return outputsObject;
}

async function hasConnections(outputs) {
  // if there is any CFN output starting with "MetaConnection" then there are connections
  return !!_.find(outputs, output => _.startsWith(output.OutputKey, 'MetaConnection'));
}

module.exports = { cfnOutputsToConnections, cfnOutputsArrayToObject, hasConnections };
