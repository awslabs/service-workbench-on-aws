# Integration Testing for Service Workbench

## Terms

**Test Administrator:** An admin-role user added in Service Workbench specifically for creating integration test resources

**Test Project:** The default project assigned for running integration tests

## Setup

- Create a Test Administrator user in your Service Workbench deployment where you want to run integration tests.
  Currently only internal auth provider can be used for authenticating this user.

- Store the Test Administrator password in AWS Parameter Store. Pick a parameter name of your choice. For the parameter type, choose 'String' and for the data type choose 'text'.

- Create/Locate the test config file in your local repository (placed in `main/integration-tests/config/settings/<STAGE>.yml`).

- Enter the Test Administrator username and the password path (AWS Parameter Store) and Test Project ID values. This file will be ignored by git when you make any changes. (Refer to the `main/integration-tests/config/settings/example.yml` file for guidance)

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
