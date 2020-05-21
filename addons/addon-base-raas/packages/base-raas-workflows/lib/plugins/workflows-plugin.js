const createEnvironmentYaml = require('../workflows/create-environment.yml');
const deleteEnvironmentYaml = require('../workflows/delete-environment.yml');
const provisionAccountYaml = require('../workflows/provision-account.yml');

const add = yaml => ({ yaml });

// The order is important, add your templates here
const workflows = [add(createEnvironmentYaml), add(deleteEnvironmentYaml), add(provisionAccountYaml)];

async function registerWorkflows(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const workflow of workflows) {
    await registry.add(workflow); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflows };
