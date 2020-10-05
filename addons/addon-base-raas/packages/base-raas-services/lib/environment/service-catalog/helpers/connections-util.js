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

function cfnOutputsToObject(outputs) {
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

module.exports = { cfnOutputsToConnections, cfnOutputsToObject, hasConnections };
