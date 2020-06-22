# LOAD & SCALABILITY TESTS ON WORKSPACES

This Node script aims at enabling a developer to perform load & scalability tests on the creation, start, stop, termination, deletion of workspaces.



## Prerequisites 

Before performing scalability test with this script, you need to prepare those things:
- Open a terminal and `cd ./script/load-test-workspaces/` and install the packages `npm install`.
- Store a fresh access token to Aws-Galileo-Gateway in the bash variable : `$ export API_TOKEN='<token_value>'`.
- In a side sheet, take note of the hostname of the Api_Gateway you want to adress. You will need it to set your configuration file.  
___Advice : you can get those information in a few actions by connecting on web browser to your version of Aws-Galileo-Gateway. (Open the network tab and you'll find the hostname of the api and your fresh Bearer token in the requests that your web browser sent.)___
- Make sure that your AWS Credentials are set and up-to-date. See the [AWS cli quickstart guide for help](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html). In case you are handling multiple accounts with the access management tool [Okta](https://www.okta.com) then, make sure to run the [python script](https://github.com/Nike-Inc/gimme-aws-creds) `gimme-aws-creds` to get fresh access to the version of Aws-Galileo-Gateway you want to test.


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
const STAGE_NAME = ''; // 'galileo-dev'
const SOLUTION_NAME = 'galileo';
const TEST_NAME_PREFIX = ''; // 'SCALABILITY-TESTS' (Case sensitive + does not support whitespaces)
const PROJECT_NAME = ''; // 'SCALABILITY-TESTS-PROJECT' (Case sensitive + does not support whitespaces)
```


## Run the script to perform the different steps of your test

You can get a full picture of the operations available with this command: `node load-test-workspaces.js help`.


***
## Usage examples

#### Create 50 Small Sagemaker Workspaces: 

Run this command : `node load-test-workspaces.js create --count 50 --platform sagemaker-1 --size sagemaker__small`

Once you should see the statusCode of the response to your calls to the API. Then, wait a few minutes until the instances are COMPLETED.
You can monitor their status by connecting on the web interface of your version of Aws-Galileo-Gateway.

_Note that those are the ``--platform`` and `--size` parameters we are currently using on the app (06/22/2020)._  
_You can update the json file used to store the catalogue by running `node load-test-workspaces.js update-catalogue`._  
_The output of `node load-test-workspaces.js help` displays the updated catalogue of workspaces you can create and target in you scalability tests._


#### Terminate all the test workspaces available: 

Run this command : `node load-test-workspaces.js terminate`

This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :
- status in `['STOPPED', 'COMPLETED', 'TERMINATING_FAILED']`, in case you wish to change it temporarily, have a look at the [statusFilter](./load-test-workspaces.js#L250)
- name contains the substring set in [your config file](./config/test-config.js) as `TEST_NAME_PREFIX` 
- associated with the project set in [your config file](./config/test-config.js) as`PROJECT_NAME`.
Depending on your needs, you can specify the `--count` `--platform` and/or `--size` parameters in order add additional criteria to the filter selecting the eleigble workspaces.


#### Delete all the test workspaces which are terminated or failed: 

Run this command : `node load-test-workspaces.js delete`

The delete command will simply remove the workspaces matching your `TEST_NAME_PREFIX` from the dynamoDb table. Doing so, they won't appear anymore in the list of workspaces visible on the web application.


#### [NOT YET IMPLEMENTED] Access all the test workspaces available: 

Run this command : `node load-test-workspaces.js access`

This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :
- status `COMPLETED`, 
- name contains the substring set as `TEST_NAME_PREFIX` 
- associated with the project set in`PROJECT_NAME`.
Depending on your needs, you can specify the `--count` `--platform` and/or `--size` parameters in order add additional criteria to the filter selecting the eleigble workspaces.

#### [NOT YET IMPLEMENTED] Stop all the test workspaces available: 

(The current version of Aws-Galileo-Gateway does not support START & STOP workspaces yet)  
Run this command : `node load-test-workspaces.js stop`

You should wait until they all pass to the status `STOPPED` before running the next command.

This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :
- status `COMPLETED`, 
- name contains the substring set as `TEST_NAME_PREFIX` 
- associated with the project set in`PROJECT_NAME`.
Depending on your needs, you can specify the `--count` `--platform` and/or `--size` parameters in order add additional criteria to the filter selecting the eleigble workspaces.

#### [NOT YET IMPLEMENTED] Restart all the test workspaces available: 

(The current version of Aws-Galileo-Gateway does not support START & STOP workspaces yet)  
Run this command : `node load-test-workspaces.js start`

You should wait until they all pass to the status `COMPLETED` before running the next command.  
This command applies a default filter to the existing workspaces in order to select the eligible workspaces that will be targeted by your command :
- status in `['STOPPED', 'TERMINATING_FAILED']`, 
- name contains the substring set as `TEST_NAME_PREFIX` 
- associated with the project set in`PROJECT_NAME`.  
Depending on your needs, you can specify the `--count` `--platform` and/or `--size` parameters in order add additional criteria to the filter selecting the eleigble workspaces.