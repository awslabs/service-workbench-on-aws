module.exports = {
  title: "Service Workbench Platform",
  tagline: "Researching data made easy",
  url: "https://your-docusaurus-test-site.com",
  baseUrl: "/",
  favicon: "img/favicon.ico",
  organizationName: "awslabs", // Usually your GitHub org/user name.
  projectName: "Service Workbench on AWS", // Usually your repo name.
  themeConfig: {
    navbar: {
      title: "Home",
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Documentation",
          items: [
            {
              label: "AWS Documentation",
              to: "https://docs.aws.amazon.com/",
            },
          ],
        },
        {
          title: "Social",
          items: [
            {
              label: "Service Workbench Blog",
              href: "https://aws.amazon.com/government-education/research-and-technical-computing/service-workbench/",
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Amazon Web Services, Inc. or its affiliates. All rights reserved.`,
    },
  },
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/awslabs/service-workbench-on-aws",
        },
        theme: {
          disableDarkMode: true, // Not working yet
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],
};
