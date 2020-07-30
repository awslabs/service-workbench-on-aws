const _ = require('lodash');

const connectionScheme = {
  http: 'http',
  https: 'https',
  rdp: 'rdp',
  ssh: 'ssh',
};
const supportedConnectionSchemes = _.values(connectionScheme);
module.exports = { connectionScheme, supportedConnectionSchemes };
