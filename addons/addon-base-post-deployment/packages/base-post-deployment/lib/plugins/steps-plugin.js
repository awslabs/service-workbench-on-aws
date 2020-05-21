const CreateRootUserService = require('../steps/create-root-user-service');
const AddAuthProviders = require('../steps/add-auth-providers');
const CreateJwtKeyService = require('../steps/create-jwt-key-service');

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
    ...existingStepsMap,
    ['createRootUser', new CreateRootUserService()],
    ['createJwtKeyService', new CreateJwtKeyService()],
    ['addAuthProviders', new AddAuthProviders()],
  ]);

  return stepsMap;
}

const plugin = {
  getSteps,
};

module.exports = plugin;
