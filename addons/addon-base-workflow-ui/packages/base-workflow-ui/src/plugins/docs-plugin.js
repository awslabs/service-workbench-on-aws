const path = require('path');

const { setSidebarsEntry } = require('@aws-ee/base-docs/lib/update-config-utils');

function getPagesPaths(pagesPathsSoFar) {
  return [...pagesPathsSoFar, path.resolve(__dirname, './docs-plugin/pages')];
}

function getStaticFilesPaths(staticFilesPathsSoFar) {
  return staticFilesPathsSoFar;
}

function getDocusaurusConfig(docusaurusConfigSoFar) {
  return docusaurusConfigSoFar;
}

function getSidebarsConfig(sidebarsConfigSoFar) {
  return setSidebarsEntry(
    sidebarsConfigSoFar,
    'docs.User Guide.Sidebar.Administrator View.Workflows',
    'user_guide/sidebar/admin/workflows/introduction',
  );
}

async function getConfiguration(configSoFar) {
  const updatedConfig = {
    pagesPaths: getPagesPaths(configSoFar.pagesPaths),
    staticFilesPaths: getStaticFilesPaths(configSoFar.staticFilesPaths),
    docusaurusConfig: getDocusaurusConfig(configSoFar.docusaurusConfig),
    sidebarsConfig: getSidebarsConfig(configSoFar.sidebarsConfig),
  };
  return updatedConfig;
}

const plugin = {
  getConfiguration,
};

module.exports = plugin;
