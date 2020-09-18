### @aws-ee/base-serverless-docs-tools

## Serverless Docs Tools

### Prerequisites

#### Tools

- [AWS CLI](https://aws.amazon.com/cli/)
- [Git CLI](https://git-scm.com/downloads)
- [Node.js 12+](https://nodejs.org/en/download/)
- [pnpm](https://pnpm.js.org/en/installation)
- [Serverless Framework](https://www.serverless.com/framework/docs/providers/aws/guide/installation/)

#### Project structure

This [Serverless Framework plugin](https://www.serverless.com/framework/docs/providers/aws/guide/plugins/) depends on the package named `@aws-ee/base-docs`. It expects the host directory (the one importing this plugin) to have a `plugin-registry.js` at `src/plugins/plugin-registry.js`.

For details on the expected structure and behavior of this plugin registry object, see the `registerDocs` function of `docs-registration-util.js` inside the `@aws-ee/base-docs` package.

This dependency is required in order to resolve contributed documentation configuration coming from one or many sources throughout the solution.

#### Project variables

This plugin expects to read configuration from the following Serverless Framework [variables](https://www.serverless.com/framework/docs/providers/aws/guide/variables/) nested under `${self:custom.settings:*}`.

**Used by [sls deploy-ui-s3](#sls-deploy-ui-s3-[--invalidate-cache%3Dfalse]):**

| Setting | Required | Default | Description
| ------- | -------- | ------- | ----------- |
| `s3BucketName` | yes | `null` | S3 bucket name to [deploy](#sls-deploy-ui-s3-[--invalidate-cache%3Dfalse]) to. |
| `s3CloudFrontDistributionId` | no | `null` | Required only if you have a CloudFront distribution and wish to use [`--invalidate-cache=true`](#--invalidate-cache%3Dtrue). |

**Used by [sls deploy-ui-ghp](#sls-deploy-ui-ghp]):**

| Setting | Required | Default | Description
| ------- | -------- | ------- | ----------- |
| `ghpGitUser` | yes | `null` | The username for a GitHub account that has commit access to this repo. For your own repositories, this will usually be your GitHub username. |
| `ghpUseSsh` | no | `false` | Set to true to use SSH instead of the default HTTPS for the connection to the GitHub repo. |
| `ghpDeploymentBranch` | no | *see description* | The branch that the website will be deployed to. Defaults to `gh-pages` for normal repos and `master` for repository names ending in "github.io". |
| `ghpCurrentBranch` | no | *see description* | The branch that contains the latest docs changes that will be deployed. Usually, the branch will be master, but it could be any branch (default or otherwise) except for `gh-pages`. If nothing is set for this variable, then the current branch will be used. |

### Usage

When installed as a [Serverless plugin](https://serverless.com/framework/docs/providers/aws/guide/plugins/), this provides the following CLI commands:

#### `sls start-ui`

Serves a Documentation UI via a local development server. This command automatically supports live reloading upon change to any `static/` or `pages/` files in source directories, as configured via `docs-registration-util.js` of `@aws-ee/base-docs`.

---

#### `sls package-ui [--local]`

Packages the UI, ready for deployment. Bundled assets are written to `./dist-autogen/build`.

##### `--local=true`

- Default: false

If enabled, JS/CSS bundles will not be minified.

---

#### `sls deploy-ui-s3 [--invalidate-cache=false]`

This command deploy artifacts to an S3 bucket.

Deploys (via `aws s3 sync`) the `./dist-autogen/build` directory to the bucket with name configured via the `s3BucketName` [variable](#project-variables).

##### `--invalidate-cache=true`

- Default: false

If enabled, invalidates a CloudFront distribution after deploying (only if the contents of the `s3BucketName` bucket were modified). Requires a `s3CloudFrontDistributionId` [variable](#project-variables) to be specified.

---

#### `sls deploy-ui-ghp`

This command deploys artifacts as a [Github Pages](https://pages.github.com/) site.

It first builds the Docusaurus site at `./dist-autogen` (writing built artifacts to `./dist-autogen/build`). Then, it creates a commit containing only these built artifacts and pushes it to the [configured](#project-variables) Git branch (creating one if it doesn't already exist).

#### Prerequisites

For this command to work as expected, you must satisfy these prerequisites:

- Populated `docusaurus.config.js` deployment entries, as described [here](#docusaurusconfigjs-settings).
- Non-empty Github repository configured as the Git origin.
- If using a private Github repository, you must have a Github [subscription](https://github.com/pricing) in order to enable Github Pages. If you are using a public repository, then Github pages are enabled by default (reading from the `gh-pages` branch).

---

#### `sls create-snapshot-ui [--tag=x.x.x]`

This command creates a new [snapshot](https://v2.docusaurus.io/docs/versioning) with the provided version string.

Note that you must run [package-ui](#sls-package-ui-[--local]) before running this command.

For further guidance on how and when to use this command, see [the docs](https://v2.docusaurus.io/docs/versioning).
