const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const { registerServices } = require('@aws-ee/base-services/lib/utils/services-registration-util');

const newHandler = require('./handler-impl');
const pluginRegistry = require('./plugins/plugin-registry');

const initHandler = (async () => {
  const container = new ServicesContainer(['settings', 'log']);
  // registerServices - Registers services by calling each service registration plugin in order.
  await registerServices(container, pluginRegistry);
  await container.initServices();
  const studyService = await container.find('studyService');
  const log = await container.find('log');
  return newHandler({ studyService, log });
})();

// eslint-disable-next-line import/prefer-default-export
module.exports.handler = async (...args) => {
  return (await initHandler)(...args);
};
