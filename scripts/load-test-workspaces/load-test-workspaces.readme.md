# LOAD & SCALABILITY TESTS ON WORKSPACES

This Node script aims at enabling a developer to perform load & scalability tests on the creation, start, stop, termination, deletion of workspaces.

To use this script and run test easily, you need two things :
- The API_HOSTNAME and API_TOKEN which will be used to send requests to the application's api. The fastest way to retrieve its value is to perform a classic manipulation on the application itself and get it from your WebBrowser's requests logs (in the dev tools > Network tab). Save temporarily your token in a shell variable `$ export=API_TOKEN` or `c:\> $env:API_TOKEN = 'API_TOKEN' in Powershell`
-  AWS Credentials will have to be set in your current AWS CLI profile to send requests directely to the DynamoDB Table and clean the workspaces which were created for the purpose of your load tests. You can use the [gimme-aws-creds](https://ici.com) python script to retrieve them quickly from your terminal.
- AWS Credentials will have to be set in your current AWS CLI profile to send requests directely to the DynamoDB Table and clean the workspaces which were created for the purpose of your load tests. Optionally you can use the [gimme-aws-creds](https://ici.com) python script to retrieve them quickly from your terminal.

Once you have both things prepared you are good to go with the following steps :

### 1 - Setup the configuration of the test in the config file
You have to set up the config in [load-test-workspaces.cong.js](./load-test-workspaces.cong.js).
Make sure to adapt the following values to your version of the application, and to the workspace naming you want to use for the test.
```
const API_HOSTNAME = 'h1z3v8yymc.execute-api.us-east-1.amazonaws.com' // you can find it quickly threw the network logs of your web browser
const REGION_NAME = 'us-east-1';
const STAGE_NAME = 'ludo-spt8';
const TEST_NAME_PREFIX = 'LOAD TEST RSTUDIO';
const PROJECT_NAME = 'LOAD TESTS'; // !!!! Make sure you create so-called project on the application !!!!
```

### 2 - Run the script to perform the different steps of your test

You can get a full picture of the operations available with this command: `node load-test-workspaces.js help`.

### 3 - Simple example of a load test with 20 RStudio workspaces

#### a) Create 20 Small RStudio Workspaces: 

Run this command : `node load-test-workspaces.js create --nb 20 --type 'rstudio' --size 't3.xlarge'`

Once you should see the statusCode of the response to our call to the API. Then, wait a few minutes until the instances are COMPLETED.

***
Note that those are the ``--type`` and `--size` parameters we are currently using on the app (05/01/2020):

`'sagemaker'` : `'ml.t3.medium'` < `'ml.t3.xlarge'` < `'ml.t3.2xlarge'`

`'rstudio'` : `'t3.xlarge'` < `'m5.8xlarge'` < `'m5a.16xlarge'`

`'hail-emr'` : `'m5.xlarge'` < `'m5.24xlarge'`

***

#### b) Access all the test workspaces available: 

Run this command : `node load-test-workspaces.js access`

***

When you do not specify the `--type` option, it considers all the types.

When you do not specify the `--size` option it considers all the sizes.

When you do not specify the `--nb` option, it considers all the instances which match the test configuration and the specification options. Otherwise it slices the array of eligible workspaces to fit this number.
***

#### b) Access all the test workspaces available: 

Run this command : `node load-test-workspaces.js access`

This command targets only the workspaces the status `COMPLETED`.

#### c) Stop all the test workspaces available: 

Run this command : `node load-test-workspaces.js stop`

This command target only the workspace with the `COMPLETED` status.
You should wait until they all pass to the status `STOPPED` before running the next command.

#### d) Terminate all the test workspaces available: 

Run this command : `node load-test-workspaces.js terminate`

This command target only the workspace with the `TERMINATED` status.

#### e) Delete all the test workspaces which are terminated or failed: 

Run this command : `node load-test-workspaces.js terminate`

This will remove the workspaces matching your `TEST_NAME_PREFIX` from the dynamoDb table.

Then go see the reaction of your cloud resources in the CloudWatch Service of your application. My advice for this is to create a resource groupe on each stack of the application so you can target them easily in the Cloudwatch dashboard.