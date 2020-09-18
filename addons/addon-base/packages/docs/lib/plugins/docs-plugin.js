const path = require('path');

const baseDocusaurusConfig = require('./docs-plugin/base-docusaurus.config');
const baseSidebarsConfig = require('./docs-plugin/base-sidebars');

function getPagesPaths(pagesPathsSoFar) {
  return pagesPathsSoFar;
}

function getStaticFilesPaths(staticFilesPathsSoFar) {
  return [...staticFilesPathsSoFar, path.resolve(__dirname, '../static')];
}

function getDocusaurusConfig(_docusaurusConfigSoFar) {
  // Set base config, ignoring any previous plugin contributions
  return baseDocusaurusConfig;
}

function getSidebarsConfig(_sidebarsConfigSoFar) {
  // Set base config, ignoring any previous plugin contributions
  return baseSidebarsConfig;
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
