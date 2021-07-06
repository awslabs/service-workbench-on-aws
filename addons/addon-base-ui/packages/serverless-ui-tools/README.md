## Prerequisites

#### Tools

- Node 12.x or later
- AWS CLI

#### Project variables

This plugin expects the following variables to exist in `${self:custom.settings}`:

- `websiteBucketName` - The S3 bucket to deploy to
- `websiteCloudFrontDistributionId` - (_Optional_) if you have a CloudFront distribution and wish to use the `--invalidate-cache` flag

This plugin also expects any number of `${self:custom.envTemplate`} environment variable mappings to exist. Local-specific overrides should be nested inside a `LocalOverrides` key. For example:

```yaml
# ========================================================================
# Variables shared between .env.local and .env.production
# ========================================================================

REACT_APP_LOCAL_DEV: false
REACT_APP_AWS_REGION: ${self:custom.settings.awsRegion}

# ========================================================================
# Overrides for .env.local
# ========================================================================

localOverrides:
  REACT_APP_LOCAL_DEV: true
  REACT_APP_API_URL: 'http://localhost:3000'
```

## Usage

When installed as a [Serverless plugin](https://serverless.com/framework/docs/providers/aws/guide/plugins/), this provides the following CLI commands:

### `sls package-ui [--local]`

Packages the UI, ready for deployment. For Create React App (the only supported UI provider at present), this also generates an `.env.local` and `.env.production` environment files (depending whether the `--local` flag is set).

#### `--local=true`

If enabled, `$ npm run build` is not executed.

- Default: false

---

### `sls deploy-ui [--build-dir]`

Deploys (via `aws s3 sync`) a target directory to the `WebsiteBucketName` bucket.

#### `--build-dir`

Specify the directory containing UI code to be deployed to S3.

- Default: `build/`

#### `--invalidate-cache=true`

If enabled, invalidates the entire CloudFront distribution after deploying (only if the bucket was modified). Requires a `websiteCloudFrontId` setting to be specified.

- Default: false

---

### `sls start-ui`

Serves the UI over a local development server.

---
