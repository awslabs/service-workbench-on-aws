module.exports = {
  "title": "Service Workbench Platform",
  "tagline": "Researching data made easy",
  "url": "https://override-me.com",
  "baseUrl": "/docs/",
  "favicon": "img/favicon.ico",
  "organizationName": "aws",
  "projectName": "docusaurus",
  "themeConfig": {
    "navbar": {
      "title": "Home",
      "hideOnScroll": false,
      "items": [
        {
          "type": "docsVersionDropdown",
          "position": "left"
        }
      ]
    }
  },
  "presets": [
    [
      "@docusaurus/preset-classic",
      {
        "docs": {
          "routeBasePath": "/",
          "versions": {
            "current": {
              "label": "Latest"
            }
          },
          "sidebarPath": "/home/ANT.AMAZON.COM/joenye/Projects/service-workbench-on-aws/main/solution/docs/dist-autogen/sidebars.json"
        },
        "theme": {
          "customCss": "/home/ANT.AMAZON.COM/joenye/Projects/service-workbench-on-aws/main/solution/docs/dist-autogen/custom.css"
        }
      }
    ]
  ]
}