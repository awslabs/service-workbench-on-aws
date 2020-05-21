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
