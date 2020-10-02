const path = require('path');

const sidebarsConfig = require('./docs-plugin/sidebars');

function _getPagesPaths(pagesPathsSoFar) {
  return [...pagesPathsSoFar, path.resolve(__dirname, './docs-plugin/pages')];
}

function _getStaticFilesPaths(staticFilesPathsSoFar) {
  return staticFilesPathsSoFar;
}

function _getDocusaurusConfig(docusaurusConfigSoFar) {
  return docusaurusConfigSoFar;
}

function _getSidebarsConfig(_sidebarsConfigSoFar) {
  // Set sidebars config, ignoring any previous plugin contributions
  return sidebarsConfig;
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
