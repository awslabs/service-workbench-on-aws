const {
  registerServices: registerServicesUtil,
} = require('@aws-ee/base-services/lib/utils/services-registration-util');
const handlerFactory = require('@aws-ee/base-workflow-core/lib/runner/handler');

const pluginRegistry = require('./plugins/plugin-registry');

/**
 * Registers services by calling each service registration plugin in order.
 *
 * @param container An instance of ServicesContainer
 * @returns {Promise<void>}
 */
async function registerServices(container) {
  return registerServicesUtil(container, pluginRegistry);
}

const handler = handlerFactory({ registerServices });

module.exports.handler = handler;
