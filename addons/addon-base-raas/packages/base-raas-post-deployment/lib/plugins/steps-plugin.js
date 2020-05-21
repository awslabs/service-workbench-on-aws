const CreateUserRoles = require('../steps/create-user-roles');
const InjectServiceEndpoint = require('../steps/inject-service-endpoint');
const CreateCloudFrontInterceptor = require('../steps/create-cloudfront-interceptor');
/**
 * Returns a map of post deployment steps
 *
 * @param existingStepsMap Map of existing post deployment steps
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<*>}
 */
// eslint-disable-next-line no-unused-vars
async function getSteps(existingStepsMap, pluginRegistry) {
  const stepsMap = new Map([
    // The userService implementation of RaaS requires the roles to be created first before a user can be created
    // One of the steps from the "existingStepsMap" tries to create root user.
    // Make sure the CreateUserRoles gets executed first before executing other post deployment steps otherwise the root
    // user creation step will fail
    ['createUserRoles', new CreateUserRoles()],
    ...existingStepsMap,
    ['injectServiceEndpoint', new InjectServiceEndpoint()],
    ['createCloudFrontInterceptor', new CreateCloudFrontInterceptor()],
  ]);

  return stepsMap;
}

const plugin = {
  getSteps,
};

module.exports = plugin;
