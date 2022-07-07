# LOAD & SCALABILITY TESTS ON WORKSPACES

This Node script aims at enabling a developer to perform load & scalability tests on the creation, start, stop, termination, deletion of workspaces.

## Prerequisites

Before performing scalability test with this script, you need to prepare those things:

- Open a terminal and `cd ./script/load-test/`.
- Store a fresh access token to Service-Workbench-On-Aws in the bash variable : `$ export API_TOKEN='<token_value>'`.
- In a side sheet, take note of the hostname of the Api*Gateway you want to adress. You will need it to set your configuration file.  
  \*\*\_Advice : you can get those information in a few actions by connecting on web browser to your version of Service-Workbench-On-Aws. (Open the network tab and you'll find the hostname of the api and your fresh Bearer token in the requests that your web browser sent.)*\*\*
- Make sure that your AWS Credentials are set and up-to-date. See the [AWS cli quickstart guide for help](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html). In case you are handling multiple accounts with the access management tool [Okta](https://www.okta.com) then, make sure to run the [python script](https://github.com/Nike-Inc/gimme-aws-creds) `gimme-aws-creds` to get fresh access to the version of Service-Workbench-On-Aws you want to test.

Once you have those few things prepared, you are ready to set your config file and run your tests :

[OPTIONAL] - For detailed assessment of the reaction of the application to your tests, I would recommend you to create a resource group for each stack of the application so you can target them easily in the Cloudwatch dashboard.

## Setup the configuration of the test in the config file

Find the config in [./config/test-config.js](./config/test-config.js).
Make sure to adapt the following values to your version of the application, and to the workspace naming you want to use for the test.

```
const API_TOKEN = process.env.API_TOKEN;
const API_HOSTNAME = ''; // 'XXXXXXXXXX.execute-api.<region>.amazonaws.com'
const REGION_NAME = '';
const REGION_SHORT_NAME = ''; // find the exhaustive list at ../../main/config/settings/.defaults.yml
const STAGE_NAME = ''; // 'sw-dev'
const SOLUTION_NAME = 'sw';
const TEST_NAME_PREFIX = ''; // 'SCALABILITY-TESTS' (Case sensitive + does not support whitespaces)
const PROJECT_NAME = ''; // 'SCALABILITY-TESTS-PROJECT' (Case sensitive + does not support whitespaces)
```

## Run the script to perform the different steps of your test

**One time task :**
The first time you use the script :

- install its packages by running `npm install`.
- download the most recent catalogue of configurations available with `node load-test.js update-catalogue`

You can get a full picture of the operations available with this command: `node load-test.js help`.  
Make sure you downloaded the updated catalogue of workspaces before running your tests : `node load-workspaces.js update-catalogue`.
The resulting catalogue is stored in the json file `./config/workspaces-catalogue.json` and is displayed dynamically in the `help` command's output.

_Note that in the following examples, the values for `--platform` and `--config` parameters we used (06/22/2020) can be different from the catalogue you have at your time._  
_You can update the json file used to store the catalogue by running `node load-test.js update-catalogue`._  
_The output of `node load-test.js help` displays the updated catalogue of workspaces you can create and target in you scalability tests._

The `node load-test.js help` command displays the list of commands that you may find self-explanatory.

---

## Usage examples

#### Create 50 Small Sagemaker Workspaces:

Run this command : `node load-test.js create --count 50 --platform sagemaker-1 --config sagemaker__small`

Once you should see the statusCode of the response to your calls to the API. Then, wait a few minutes until the instances are COMPLETED.
You can monitor their status by connecting on the web interface of your version of Service-Workbench-On-Aws.

#### Terminate all the test workspaces available:

Run this command : `node load-test.js terminate`

This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :

- status in `['STOPPED', 'COMPLETED', 'TERMINATING_FAILED']`, in case you wish to change it temporarily, have a look at the [statusFilter](./load-test.js#L250)
- name contains the substring set in [your config file](./config/test-config.js) as `TEST_NAME_PREFIX`
- associated with the project set in [your config file](./config/test-config.js) as `PROJECT_NAME`.
  Depending on your needs, you can specify the `--count` `--platform` and/or `--config` parameters in order add additional criteria to the filter selecting the eleigble workspaces.

#### Delete all the test workspaces which are terminated or failed:

Run this command : `node load-test.js delete`

The delete command will simply remove the workspaces matching your `TEST_NAME_PREFIX` from the dynamoDb table. Doing so, they won't appear anymore in the list of workspaces visible on the web application.

#### Stop all the test workspaces available:

(The current version of Service-Workbench-On-Aws does not support START & STOP workspaces yet)  
Run this command : `node load-test.js stop`

You should wait until they all pass to the status `STOPPED` before running the next command.

This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :

- status `COMPLETED`,
- name contains the substring set as `TEST_NAME_PREFIX`
- associated with the project set in`PROJECT_NAME`.
  Depending on your needs, you can specify the `--count` `--platform` and/or `--config` parameters in order add additional criteria to the filter selecting the eleigble workspaces.

#### Restart all the test workspaces available:

(The current version of Service-Workbench-On-Aws does not support START & STOP workspaces yet)  
Run this command : `node load-test.js start`

You should wait until they all pass to the status `COMPLETED` before running the next command.  
This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :

- status in `['STOPPED', 'TERMINATING_FAILED']`,
- name contains the substring set as `TEST_NAME_PREFIX`
- associated with the project set in`PROJECT_NAME`.  
  Depending on your needs, you can specify the `--count` `--platform` and/or `--config` parameters in order add additional criteria to the filter selecting the eleigble workspaces.

#### [NOT YET IMPLEMENTED] Access all the test workspaces available:

Run this command : `node load-test.js access`

This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :

- status `COMPLETED`,
- name contains the substring set as `TEST_NAME_PREFIX`
- associated with the project set in`PROJECT_NAME`.
  Depending on your needs, you can specify the `--count` `--platform` and/or `--config` parameters in order add additional criteria to the filter selecting the eleigble workspaces.
