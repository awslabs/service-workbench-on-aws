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
