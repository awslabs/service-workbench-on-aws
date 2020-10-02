const path = require('path');

const { setSidebarsEntry } = require('@aws-ee/base-docs/lib/update-config-utils');

function _getPagesPaths(pagesPathsSoFar) {
  return [...pagesPathsSoFar, path.resolve(__dirname, './docs-plugin/pages')];
}

function _getStaticFilesPaths(staticFilesPathsSoFar) {
  return staticFilesPathsSoFar;
}

function _getDocusaurusConfig(docusaurusConfigSoFar) {
  return docusaurusConfigSoFar;
}

function _getSidebarsConfig(sidebarsConfigSoFar) {
  return setSidebarsEntry(
    sidebarsConfigSoFar,
    'docs.User Guide.Sidebar.Administrator View.Workflows',
    'user_guide/sidebar/admin/workflows/introduction',
  );
}

async function getConfiguration(configSoFar) {
  const updatedConfig = {
    pagesPaths: _getPagesPaths(configSoFar.pagesPaths),
    staticFilesPaths: _getStaticFilesPaths(configSoFar.staticFilesPaths),
    docusaurusConfig: _getDocusaurusConfig(configSoFar.docusaurusConfig),
    sidebarsConfig: _getSidebarsConfig(configSoFar.sidebarsConfig),
  };
  return updatedConfig;
}

const plugin = {
  getConfiguration,
};

module.exports = plugin;
