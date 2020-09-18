const path = require('path');

function getPagesPaths(pagesPathsSoFar) {
  // Solution-specific page contributions should be registered here
  return [...pagesPathsSoFar, path.resolve(__dirname, './docs-plugin/pages')];
}

function getStaticFilesPaths(staticFilesPathsSoFar) {
  // Solution-specific static file contributions should be registered here
  return [...staticFilesPathsSoFar, path.resolve(__dirname, './docs-plugin/static')];
}

function getDocusaurusConfig(docusaurusConfigSoFar) {
  return {
    // Solution-specific configuration overrides go here
    ...docusaurusConfigSoFar,
    baseUrl: '/docs/',
  };
}

function getSidebarsConfig(sidebarsConfigSoFar) {
  return {
    // Solution-specific sidebars configuration overrides go here
    docs: {
      'Service Workbench': ['introduction'],
      ...sidebarsConfigSoFar.docs,
    },
  };
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
