/* eslint-disable global-require */
const deleteEnvironment = require('../steps/delete-environment/delete-environment');
const deleteEnvironmentYaml = require('../steps/delete-environment/delete-environment.yml');
const provisionAccount = require('../steps/provision-account/provision-account');
const provisionAccountYaml = require('../steps/provision-account/provision-account.yml');
const provisionEnvironment = require('../steps/provision-environment/provision-environment');
const provisionEnvironmentYaml = require('../steps/provision-environment/provision-environment.yml');

const add = (implClass, yaml) => ({ implClass, yaml });

// The order is important, add your steps here
const steps = [
  add(deleteEnvironment, deleteEnvironmentYaml),
  add(provisionAccount, provisionAccountYaml),
  add(provisionEnvironment, provisionEnvironmentYaml),
];

async function registerWorkflowSteps(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    const { implClass, yaml } = step;
    await registry.add({ implClass, yaml }); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowSteps };
