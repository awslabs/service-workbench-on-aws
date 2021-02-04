# Integration Testing for Service Workbench

## Terms

**Test Administrator:** An admin-role user added in Service Workbench specifically for creating integration test resources

**Test Project:** The default project assigned for running integration tests

## Setup and Execution:

   Create a Test Administrator user in your Service Workbench deployment where you want to run integration tests. 
   Currently only internal auth provider can be used for authenticating this user.

   Locate the test config file in your local repository (placed in `main/integration-tests/config/test-config.json`).
   Enter the Test Administrator credentials and Test Project ID values (This file will be ignored by git and therefore will only remain on your local machine)
   
   Now run the command below to trigger the integration test suite. 
   Note that this will generate test-related resources in the deployment linked to the provided stage name.

```bash
$ scripts/run-integration-tests.sh <stage>
```
