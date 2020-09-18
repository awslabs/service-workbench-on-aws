const path = require('path');

const sidebarsConfig = require('./docs-plugin/sidebars');

function getPagesPaths(pagesPathsSoFar) {
  return [...pagesPathsSoFar, path.resolve(__dirname, './docs-plugin/pages')];
}

function getStaticFilesPaths(staticFilesPathsSoFar) {
  return staticFilesPathsSoFar;
}

function getDocusaurusConfig(docusaurusConfigSoFar) {
  return docusaurusConfigSoFar;
}

function getSidebarsConfig(_sidebarsConfigSoFar) {
  // Set sidebars config, ignoring any previous plugin contributions
  return sidebarsConfig;
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
