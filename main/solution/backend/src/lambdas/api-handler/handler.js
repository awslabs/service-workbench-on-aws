const handlerFactory = require('@aws-ee/base-api-handler-factory');
const {
  registerServices: registerServicesUtil,
} = require('@aws-ee/base-services/lib/utils/services-registration-util');
const { registerRoutes: registerRoutesUtil } = require('@aws-ee/base-api-handler/lib/routes-registration-util');

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

/**
 * Configures the given express router by collecting routes contributed by all route plugins.
 * @param context An instance of AppContext from api-handler-factory
 * @param router Top level Express router
 *
 * @returns {Promise<unknown[]>}
 */
async function registerRoutes(context, router) {
  return registerRoutesUtil(context, router, pluginRegistry);
}

// The main lambda handler function. This is the entry point of the lambda function
// Calls handlerFactory that creates a Lambda function
// 1. by creating an Express JS application instance and registering all API routes by calling the "registerRoutes" function we pass here
// 2. by initializing a services container instance and registering all service instances to the container by calling the "registerServices" function we pass here
// The handler function returned by the "handlerFactory" has the classical Lambda handler function signature of (event, context) => Promise
const handler = handlerFactory({ registerServices, registerRoutes });

module.exports.handler = handler;
