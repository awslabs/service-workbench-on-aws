const baseDocsPlugin = require('@aws-ee/base-docs/lib/plugins/docs-plugin');
const raasDocsPlugin = require('@aws-ee/base-raas-ui/src/plugins/docs-plugin');
const workflowDocsPlugin = require('@aws-ee/base-workflow-ui/src/plugins/docs-plugin');
const docsPlugin = require('./docs-plugin');

const extensionPoints = {
  docs: [baseDocsPlugin, raasDocsPlugin, workflowDocsPlugin, docsPlugin],
};

async function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint] || [];
}

const registry = {
  getPlugins,
};

module.exports = registry;
