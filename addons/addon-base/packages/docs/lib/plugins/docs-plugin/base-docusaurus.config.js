module.exports = {
  title: 'Solution Documentation',
  url: 'https://override-me.com',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'aws-ee',
  projectName: 'docs',
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
