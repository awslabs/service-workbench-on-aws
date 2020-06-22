# @aws-ee/base-serverless-settings-helper

This package provides a helper to merge solution settings files with local and solution-level defaults.

## Example Usage

In `<rootDir>/sls-settings.defaults.yml`:

```yaml
solutionName: awesome-poc
dbPrefix: ${opt:stage}-db-
```

In `<rootDir>/sls-settings.alice.yml`:

```yaml
awsProfile: awesome-poc-admin
awsRegion: us-east-1
dbPrefix: bob-db- # temporarily override to point at Bob's stack.
```

In `<rootDir>/serverless.yml`:

```yaml
service: ${self:custom.settings.awsRegionShortName}-${self:custom.settings.solutionName}-website
provider:
  name: aws
  region: ${self:custom.settings.awsRegion}
  profile: ${self:custom.settings.awsProfile}
  stackName: ${self:custom.settings.envName}-${self:service}
custom:
  settings: ${file(./settings.js):merged}
resources:
  - Description: The infrastructure stack for [${self:custom.settings.solutionName}] and env [${self:custom.settings.envName}]
```

Finally, in `settings.js`:

```javascript
module.exports.merged = require('@aws-ee/base-serverless-settings-helper').mergeSettings(__dirname, [
  './sls-settings.defaults.yml',
  './sls-settings.${stage}.yml',
]);
```

Now, if we run `serverless print -s alice`, we get:

```yaml
service: awesome-poc-website
provider:
  region: us-east-1
  name: aws
  profile: awesome-poc-admin
  stackName: alice-awesome-poc-website
custom:
  settings:
    solutionName: awesome-poc
    envName: alice
    dbPrefix: bob-db- # Note the override of `alice-db-` with `bob-db-`
    awsProfile: awesome-poc-admin
    awsRegion: us-east-1
resources:
  - Description: 'The infrastructure stack for [awesome-poc] and env [alice]'
```
