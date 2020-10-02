const path = require('path');

const baseDocusaurusConfig = require('./docs-plugin/base-docusaurus.config');
const baseSidebarsConfig = require('./docs-plugin/base-sidebars');

function _getPagesPaths(pagesPathsSoFar) {
  return pagesPathsSoFar;
}

function _getStaticFilesPaths(staticFilesPathsSoFar) {
  return [...staticFilesPathsSoFar, path.resolve(__dirname, '../static')];
}

function _getDocusaurusConfig(_docusaurusConfigSoFar) {
  // Set base config, ignoring any previous plugin contributions
  return baseDocusaurusConfig;
}

function _getSidebarsConfig(_sidebarsConfigSoFar) {
  // Set base config, ignoring any previous plugin contributions
  return baseSidebarsConfig;
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
