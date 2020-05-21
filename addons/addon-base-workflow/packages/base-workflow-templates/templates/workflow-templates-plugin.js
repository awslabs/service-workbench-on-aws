const emptyWorkflowYaml = require('./empty-workflow.yml');

const add = yaml => ({ yaml });

// The order is important, add your templates here
const templates = [add(emptyWorkflowYaml)];

async function registerWorkflowTemplates(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const template of templates) {
    await registry.add(template); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowTemplates };
