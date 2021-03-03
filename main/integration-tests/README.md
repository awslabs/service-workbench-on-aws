# Integration Testing for Service Workbench

## Terms

**Test Administrator:** An admin-role user added in Service Workbench specifically for creating integration test resources

**Test Project:** The default project assigned for running integration tests

## Setup

- Create a Test Administrator user in your Service Workbench deployment where you want to run integration tests.
  Currently only internal auth provider can be used for authenticating this user.

- Store the Test Administrator password in AWS Parameter Store. Pick a parameter name of your choice. For the parameter type, choose 'SecureString' and for the data type choose 'text'.

- Create/Locate the test config file in your local repository (placed in `main/integration-tests/config/settings/<STAGE>.yml`). This will be useful when you're triggering the tests locally.

- Enter the Test Administrator username, password path (AWS Parameter Store), Test Project ID, and the rest of the values as directed in the `main/integration-tests/config/settings/example.yml` file. Your config file will be ignored by git when you make any changes.

### For CI/CD Pipeline

- Ensure the `isBuildServer` parameter value is set to `true` in your `main/integration-tests/config/settings/<STAGE>.yml` config file
- Ensure the `awsProfile` value corresponds to the correct AWS account
- Follow the steps mentioned in the `main/cicd/README.md` file to set up the CI/CD Pipeline
- The integration test config file is automatically saved in your S3 `<namespace>-artifacts` bucket as part of this process, in the `integration-test` folder

### For GitHub Pipeline

- Create/Locate the integration test config file in your S3 `<namespace>-artifacts` bucket's `integration-test` folder
- Ensure the `isBuildServer` parameter value is set to `true` in your config file
- Ensure the following GitHub secrets are created in your target repository: 
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - DEPLOYMENT_BUCKET (same as `<namespace>-artifacts`)


### For Debugging Tests against Deployed Application

- Ensure the `isBuildServer` parameter value is set to `false`

### For Debugging Tests Locally (SLS Offline)

- Ensure the `isBuildServer` parameter value is set to `false`
- Ensure the `isLocal` parameter value is set to `true`. Verify the `localApiEndpoint` parameter value is accurate
- Remember to launch sls offline

**Note**

This file is unique from the rest of the `<STAGE>.yml` files created in the SDCs in that it does not gather serverless settings passed on from the hierarchies above (eg. from `main/config/settings/.defaults.yml`)

## Execution:

Now run the command below to trigger the integration test suite. Note that this will generate test-related resources in the deployment linked to the provided stage name.

```bash
$ scripts/run-integration-tests.sh <STAGE>
```

If you want to run a specific test suite, you can use the following command:

```bash
$ cd integration-tests
$ pnpm intTest __test__/api-tests/<your test suite file> -- --stage=<STAGE>
# IMPORTANT: notice the additional '-- ' in front of the '--stage='
```
