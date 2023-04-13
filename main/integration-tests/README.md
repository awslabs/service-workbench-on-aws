# Integration Tests for Service Workbench

## Intro

The integration-tests package is used for running API tests against all SWB APIs.
These tests can run against local and dev environments during development.
They can also be configured to run automatically as part of a GitHub workflow or CI/CD pipeline.
Advanced integration tests involve interacting with a provisioned workspace, and require additional setup.

## Prerequisites

### Test Resources

To run integration tests, the following resources need to be created in advance:

#### Resources to create through SWB UI:

- **Test Administrator:** Create an internal admin-role user for running integration tests. (**Note the username and password**)


- **Test Project:** Create a default project for running integration tests. (**Note the projectId**)

- **AWS Budget:** Create a budget for the AWS account associated with the Test Project.

#### Resources for Advanced Tests

- **Environment Type:** Import each specific Service Catalog product as an environment type.

- **Environment Configuration:** Create a configuration for every corresponding environment type that was created.

- **Data Source Study:** If testing BYOB studies, create an external BYOB study on the deployment with read and write access.


#### Resources to create through AWS Console:

- **Test Administrator password:** Create an AWS Parameter Store record to store Test Administrator password. Pick a parameter name of your choice. Use 'SecureString' for parameter type 'text' for data type.(**Note the parameter name**)

- **Cost Explorer:** Enable Cost Explorer service and activate the 'Env', 'Proj' and 'createdBy' tags.

### Config File

Once test resources are created, create a config file `main/integration-tests/config/settings/<STAGE>.yml` follow the example `main/integration-tests/config/settings/example.yml`.
Use the same `<STAGE>` name as the main config file in `/main/config/settings`.

Use Test Admin username, projectId, and Parameter Store name noted from the [Test Resources](#test-resources) section for field username, passwordPath and projectId in the config file.
Use the same config values used in `/main/config/settings` for the fields awsRegion, awsProfile, solutionName, envName, and envType.

For each `{workspaceType}EnvTypeId` and `{workspacetype}ConfigId`, use the IDs for the specific environment type and environment configuration created as test resources.

For `byobStudy`, supply the ID for the external data source study.

**Note**

This file is unique from other `<STAGE>.yml` files under other SDCs. It does not gather serverless settings passed on from the hierarchies above (eg. from `main/config/settings/.defaults.yml`)

## Execution

Once test resources and config file are created, you can run the integration tests against the non-production environment defined in the config file.

Note: Integration tests will create resources in the environment they are executed against.

### Run against dev environment

- In config file `main/integration-tests/config/settings/<STAGE>.yml`
  - set `isBuildServer` to `false`
  - set `isLocal` to `false`

##### Run all integration tests from the root directory with:

Run AppStream tests. AppStream and Egress should be enabled in the testing environment
```bash
$ scripts/run-integration-tests.sh <STAGE> <REGION> AppStreamEgress 
```

Run non AppStream tests
```bash
$ scripts/run-integration-tests.sh <STAGE> <REGION>
```

Run specific test suites under `main/integration-tests` with:

```bash
$ pnpm intTestSpecific __test__/api-tests/<your test suite file> -- --stage=<STAGE>
# IMPORTANT: notice the additional '-- ' in front of the '--stage='
```

### Run against local deployment (SLS Offline)

- In config file `main/integration-tests/config/settings/<STAGE>.yml`
  - set `isBuildServer` to `false`
  - set `isLocal` to `true`
  - set `localApiEndpoint` to local API endpoint
- Launch sls offline
- Trigger integration tests with the same [commands](#run-all-integration-tests-from-the-root-directory-with)

### Run in CI/CD Pipeline

- In config file `main/integration-tests/config/settings/<STAGE>.yml`
  - set `isBuildServer` to `true`
  - set `isLocal` to `false`
  - set `awsProfile` to the AWS account used for integration tests
- Follow the steps mentioned in the `main/cicd/README.md` file to set up the CI/CD Pipeline
- The integration test config file will be automatically saved in the deployment S3 bucket `<namespace>-artifacts` under `integration-test` folder
- Integration test will be triggered as part of the CI/CD pipeline

### Run in GitHub Workflow

- In config file `main/integration-tests/config/settings/<STAGE>.yml`
  - set `isBuildServer` to `true`
  - set `isLocal` to `false`
- Upload the config file to the deployment S3 bucket `<namespace>-artifacts` under `integration-test` folder if it's not present
- Create the following GitHub secrets in your target repository:
  - AWS_ROLE_TO_ASSUME (the GitHubActionsRoleArn output value in your OIDC provider stack)
  - AWS_DEV_REGION
  - DEPLOYMENT_BUCKET (set the value to `<namespace>-artifacts`)
- Integration test will be triggered as part of a GitHub workflow
