const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const { registerServices } = require('@aws-ee/base-services/lib/utils/services-registration-util');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const pluginRegistry = require('./plugins/plugin-registry');

const handler = async () => {
  const container = new ServicesContainer(['settings', 'log']);
  // registerServices - Registers services by calling each service registration plugin in order.
  await registerServices(container, pluginRegistry);
  await container.initServices();
  const environmentScService = await container.find('environmentScService');
  const userContext = getSystemRequestContext();
  const envData = await environmentScService.pollAndSyncWsStatus(userContext);
  return { statusCode: 200, body: envData };
};

// eslint-disable-next-line import/prefer-default-export
module.exports.handler = handler;
