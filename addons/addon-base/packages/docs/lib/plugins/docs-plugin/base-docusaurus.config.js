module.exports = {
  title: 'Service Workbench Platform',
  tagline: 'Researching data made easy',
  url: 'https://override-me.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'aws',
  projectName: 'docusaurus',
  themeConfig: {
    navbar: {
      title: 'Home',
      hideOnScroll: false,
      items: [
        {
          type: 'docsVersionDropdown',
          position: 'left',
        },
      ],
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          routeBasePath: '/',
          // includeCurrentVersion: false,
          versions: {
            current: {
              label: 'Latest',
            },
          },
        },
      },
    ],
  ],
};
