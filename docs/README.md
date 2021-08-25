# Installing Service Workbench Documentation using local installation

### Prerequisites

+ Service Workbench [source code](https://github.com/awslabs/service-workbench-on-aws/tags) must be downloaded to your local machine. For information on downloading the Service Workbench source code, read [Service Workbench Installation Guide](/docs/Service_Workbench_Installation_Guide.pdf).
+ Go to the **docs** directory under Service Workbench folder.

You can download the PDF versions of other guides using the links provided [here](https://github.com/awslabs/service-workbench-on-aws/blob/mainline/README.md).

**Important**: *Do not click and open the help pages directly from the **docs** folder. These are configured to open only from the Docusaurus site.*

### Installing Yarn

Under the docs directory, run the following command:

```
$ yarn
```
**Note**: If this command does not work, you will need to install the [Yarn](https://classic.yarnpkg.com/en/docs/install/) package.

### Launching the Docusaurus site

To launch documentation using Docusaurus, run the following command:

```
$ yarn start
```
This command starts a local development server and opens up the browser window. Most changes are reflected live without having to restart the server.

### Build

```
$ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service. 

**Note**: We recommend you to run this command once when you install Yarn. It is not required every time when you run Documentation using Docusaurus.



