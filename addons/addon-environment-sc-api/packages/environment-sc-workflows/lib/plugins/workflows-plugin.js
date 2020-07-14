const provisionEnvironmentScYaml = require('../workflows/provision-environment-sc.yml');
const terminateEnvironmentScYaml = require('../workflows/terminate-environment-sc.yml');

const add = yaml => ({ yaml });

// The order is important, add your templates here
const workflows = [add(provisionEnvironmentScYaml), add(terminateEnvironmentScYaml)];

async function registerWorkflows(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const workflow of workflows) {
    await registry.add(workflow); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflows };
