### @aws-ee/docs

## Docs

This SDC is responsible for building and deploying the solution's [Docusaurus](https://v2.docusaurus.io/)-based static site.

Unlike many other SDCs, no CloudFormation is deployed by this SDC. Instead, it serves as an entry point for invoking commands provided by the [`@aws-ee/base-serverless-docs-tools`](../../../addons/addon-base/packages/serverless-docs-tools) [Serverless Framework plugin](https://www.serverless.com/framework/docs/providers/aws/guide/plugins/).

This plugin automatically combines registered (as configured in [./src/plugins/plugin-registry.js](./src/plugins/plugin-registry.js)) [Docusaurus Configuration](https://v2.docusaurus.io/docs/configuration/), [Sidebar Configuration](https://v2.docusaurus.io/docs/docs-introduction/#sidebar), [Pages](https://v2.docusaurus.io/docs/creating-pages), and [Static Assets](https://v2.docusaurus.io/docs/static-assets) sources, and writes them to the [`./dist-autogen/`](./dist-autogen) directory. The [`./dist-autogen/`](./dist-autogen) directory contains the finalised source for the Docusaurus site, and *changes here should be committed to source control*.

The [CLI commands](#basic-usage) provided by this plugin manipulate one or many of these files and directories:

- `./dist-autogen/docs/`
- `./dist-autogen/static/`
- `./dist-autogen/sidebars.json`
- `./dist-autogen/docusaurus.config.js`
- `./dist-autogen/versioned_docs/` (if [versioning](#managing-versions) enabled)
- `./dist-autogen/versioned_sidebars/` (if [versioning](#managing-versions) enabled)
- `./dist-autogen/versions.json` (if [versioning](#managing-versions) enabled)

All other files and directories under [`./dist-autogen/`](./dist-autogen) should be manually edited if required.

---

### Basic Usage

Note: see the [README](../../../addons/addon-base/packages/serverless-docs-tools/README.md) of the [`@aws-ee/base-serverless-docs-tools`](../../../addons/addon-base/packages/serverless-docs-tools) package for more comprehensive usage documentation.

#### Local development

To start the documentation site locally:

```
$ pnpx sls start-ui --stage <stage name>
```

This command provides live sync and reload, such that changes to any [registered](./src/plugins/plugin-registry.js) `pages/` or `static/` source directories are automatically propagated to [`./dist-autogen`](./dist-autogen) and made visible.

#### Packaging

To package for deployment to S3 (with minified JS/CSS bundles):

```
$ pnpx sls package-ui --stage <stage name>
```

To package for deployment to S3 (without minifying JS/CSS bundles):

```
$ pnpx sls package-ui --local=true --stage <stage name>
```

#### Deploying

##### S3

To deploy the last [packaged](#packaging) bundle to S3:

```
$ pnpx sls deploy-ui-s3 --stage <stage name>
```

To deploy the last [packaged](#packaging) bundle to S3 and invalidate the CloudFront cache:

```
$ pnpx sls deploy-ui-s3 --invalidate-cache=true --stage <stage name>
```

##### Github Pages

To package and deploy via Github Pages:

```
$ pnpx sls deploy-ui-ghp --stage <stage name>
```

#### Managing versions

To create a new versioned Docusaurus snapshot:

```
$ pnpx sls create-snapshot-ui --tag=<version tag> --stage <stage name>
```
