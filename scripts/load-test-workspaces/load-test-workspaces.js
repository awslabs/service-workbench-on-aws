#!/usr/bin/env node

/** 
 * This Node script aims at enabling a developer to perform load & scalability tests for the function creating/starting/terminating/... the workspaces
 * @Required : 
 *  - Set up the config file : load-test-workspaces.config.js
 *  - You need to retrieve a user token to get the authorization to perform such requests.
 * @Optional : If you want to remove all traces of the test workspaces created by this script, you will need to get your AWS credentials available for your terminal session.
 * @Usage : 
 *  - Get help on how to run the script : $ node load-test-workspaces.js --help'
 *  - Create 5 Small Sagemaker workspaces : $ node load-test-workspaces.js create --nb 5 --type 'sagemaker' --size 'ml.t3.medium'
 *  - Access all Rstudio test workspaces : $ node load-test-workspaces.js access --type 'rstudio'
 *  - Terminate all test Workspaces : $ node load-test-workspaces.js terminate
 *  - Remove terminated or failed test workspaces from the Dynamo Db Table : $node load-test-workspaces.js delete
 */

const { makeApiRequest, sleep, filterSetCookie } = require('./load-test-workspaces.utils');
const config = require('./load-test-workspaces.config');
const yargs = require('yargs');
const AWS = require('aws-sdk');


// ==============================================================================================================================
//  COMMAND LINE DEFINITION
// ==============================================================================================================================
function parseCLIArguments() {
  const argv = yargs
    .command('create', '--> Create workspaces simultaneously.')
    .command('access', '--> Access workspaces simultaneously.')
    .command('terminate', '--> Terminate workspaces simultaneously.')
    .command('delete', '--> Delete load test workspaces from dynamoDB simultaneously.')
    .command('start', '--> Start workspaces simultaneously.')
    .command('stop', '--> Stop workspaces simultaneously.')
    .option('nb', {
      alias: 'n',
      description: 'Number of simultaneous workspaces to operate on',
      type: 'number',
    })
    .option('type', {
      alias: 't',
      description: 'Type of workspaces to operate on ("sagemaker" | "hail-emr" | "rstudio")',
      type: 'string',
    })
    .option('size', {
      alias: 's',
      description: 'Size of the workspaces to operate on.\nSagemaker: ml.t3.medium < ml.t3.xlarge < ml.t3.2xlarge,\nHail-EMR: m5.xlarge < m5.24xlarge\nRStudio: t3.xlarge < m5.8xlarge < m5a.16xlarge',
      type: 'string',
    })
    .help()
    .argv;

  if (argv._.length !== 1) {
    throw new Error('Exactly one command should be used : "create" || "access" || "terminate" || "delete" || "start" || "stop"');
  }
  return argv;
}

let argv;
try {
  argv = parseCLIArguments();
} catch (err) {
  console.error('Wrong command line arguments. Please type node load-test-workspace.js --help for usage details.');
  console.error(err.message + '\n');
  return;
}
const OPERATION = argv._[0];

// ==============================================================================================================================
//  LOAD TEST - CREATE WORKSPACES
// ==============================================================================================================================

async function loadTest_createWorkspaces(request_options, projectName, count, type, size) {

  const req_options = {
    ...request_options,
    method: 'POST'
  }

  if (type === undefined || size === undefined) {
    throw (new Error(`Wrong type and/or size: type[${type}], size[${size}].`));
  }
  const payloads = [...Array(count)].map((_, index) => {
    return JSON.stringify({
      name: `${config.TEST_NAME_PREFIX} [${type.toUpperCase()}] - ${index + 1}on${count}`,
      description: `Load test workspace ${type} ${size} - test ${index + 1}`,
      instanceInfo: {
        type: type,
        size: size,
        cidr: '0.0.0.0/0',  // TODO: different for Hail-EMR
        config: {},         // TODO: different for Hail-EMR
      },
      isExternal: false,
      projectId: projectName,
    });
  });

  const workspacesList = [];
  const promises = [];
  for (let i = 0; i < payloads.length; i++) {
    const payload = payloads[i];
    console.log(`Creating ${JSON.parse(payload).name} ...`);
    workspacesList.push({ name: JSON.parse(payload).name });
    const promise = makeApiRequest(req_options, payload);
    promises.push(promise);
    // sleep to avoid Auth0 rate limiting
    await sleep(500);
  };

  // Wait for the resolution of all the requests
  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

// ==============================================================================================================================
//  LOAD TEST - ACCESS WORKSPACES
// ==============================================================================================================================

async function loadTest_accessWorkspaces(request_options, workspacesList) {

  // Send requests to simulate the access to those workspaces
  const promises = [];
  workspacesList.forEach(workspace => {
    console.log(`Accessing ${workspace.name} (${workspace.instanceInfo.type}) ...`);
    switch (workspace.instanceInfo.type) {
      case 'rstudio':
        promises.push(accessRStudioWorkspace(request_options, workspace.id));
        break;
      default:
        //TODO : cases 'sagemaker' and 'hail-emr'
        console.log(`TODO : access other types of workspaces : ${workspace.instanceInfo.type}`);
    }
  });

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

async function accessRStudioWorkspace(request_options, workspaceId) {

  // REQUEST 1 : Ask for the authorized url of the Rstudio Workspace
  const request1 = {
    ...request_options,
    path: `${request_options.path}/${workspaceId}/url`,
    method: 'GET',
  };
  const response1 = await makeApiRequest(request1);
  if (!response1.body || !JSON.parse(response1.body).AuthorizedUrl) {
    return response1;
  }

  // REQUEST 2 : Ask for access to the Rstudio instance url (response contains a redirection)
  const authorizedUrl = new URL(JSON.parse(response1.body).AuthorizedUrl);
  const request2 = {
    hostname: authorizedUrl.hostname,
    path: authorizedUrl.pathname + authorizedUrl.search,
    method: 'GET'
  };
  const response2 = await makeApiRequest(request2);
  if (!response2.headers || !response2.headers.location) {
    return {
      statusCode: `${response1.statusCode} - ${response2.statusCode}`,
      headers: `${response1.headers} - ${response2.headers}`,
      body: `${response1.body} - ${response2.body}`,
    };
  }

  // REQUEST 3 : access the final web-browser interface url to the rstudio workspace
  const location = new URL(response2.headers.location);
  const cookie = filterSetCookie(response2.headers['set-cookie'][0]);
  const request3 = {
    hostname: location.hostname,
    path: location.pathname,
    method: 'GET',
    headers: {
      'Connection': 'keep alive',
      'Cookie': [cookie],
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv: 75.0) Gecko/20100101 Firefox/75.0'
    },
  };
  const response3 = await makeApiRequest(request3);

  const statusCode = response1.statusCode === 200 && response2.statusCode === 302 && response3.statusCode === 200
    ? 200
    : `${response1.statusCode} - ${response2.statusCode} - ${response3.statusCode}`;
  return {
    statusCode: statusCode,
    headers: `${response1.headers} - ${response2.headers} - ${response3.headers}`,
    body: `${response1.body} - ${response2.body} - ${response3.body}`,
  };
}

// ==============================================================================================================================
//  LOAD TEST - START OR STOP WORKSPACES
// ==============================================================================================================================

async function loadTest_toggleWorkspaces(request_options, workspacesList, operation) {

  const req_options = {
    ...request_options,
    method: 'PUT',
  };

  const promises = [];
  workspacesList.forEach(workspace => {
    console.log(`${operation === 'start' ? 'Starting' : 'Stopping'} ${workspace.name} (id:${workspace.id}) ...`);
    req_options.path = `${request_options.path}/${workspace.id}/${operation}`
    promises.push(makeApiRequest(req_options));
  });

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

// ==============================================================================================================================
//  LOAD TEST - TERMINATE WORKSPACES
// ==============================================================================================================================

async function loadTest_terminateWorkspaces(request_options, workspacesList) {

  const req_options = {
    ...request_options,
    method: 'DELETE'
  };

  // Send requests to simulate the access to those workspaces
  const promises = [];
  for (let i = 0; i < workspacesList.length; i++) {
    const workspace = workspacesList[i];
    console.log(`Terminating ${workspace.name} (id:${workspace.id}) ...`);
    req_options.path = `${request_options.path}/${workspace.id}`
    const promise = makeApiRequest(req_options);
    promises.push(promise);
  }

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

// ==============================================================================================================================
//  LOAD TEST - CLEAN WORKSPACES FROM DYNAMO_DB TABLE
// ==============================================================================================================================

async function load_test_removeWorkspacesFromDB(workspacesList, tableName, region) {

  AWS.config.update({ region: region });
  const DDB = new AWS.DynamoDB();

  const promises = [];
  workspacesList.forEach(workspace => {
    const deleteParam = {
      Key: {
        "id": { S: workspace.id },
      },
      TableName: tableName,
    };
    console.log(`Removing ${workspace.name} (id: ${workspace.id}) from the table...`);
    const promise = new Promise((resolve, reject) => {
      DDB.deleteItem(deleteParam, (err) => {
        if (err) {
          reject(new Error('Error when sending the dynamoDb deleteItem request. Make sure you have your AWS credentials set.'));
        };
        resolve({ statusCode: 200 });
      });
    });
    promises.push(promise);
  });

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}


// ==============================================================================================================================
//  MAIN FUNCTION
// ==============================================================================================================================

function logResponses(responses, workspacesList) {
  for (let i = 0; i < responses.length; i++) {
    console.log(`[${workspacesList[i].name}] : response status ---> ${responses[i].statusCode}`);
  }

  for (let i = 0; i < responses.length; i++) {
    if (responses[i].statusCode !== 200) {
      console.log(`[RESPONSE ${responses[i].statusCode} for ${workspacesList[i].name}]. Response body :`);
      console.log(responses[i].body);
    }
  }
}


async function fetchTestWorkspacesFilteredList(request_options, projectName, count, type, size, status = ['COMPLETED']) {

  console.log(`Fetching ${count ? `${count} ` : ''}eligible workspaces. Filters: ${projectName ? `[project-name = ${projectName}],` : ''}${type ? `[type = ${type}],` : ''}${size ? `[size = ${size}],` : ''}${status ? `[status = ${status}],` : ''}`);

  const req_options = {
    ...request_options,
    method: 'GET'

  }

  let workspacesList;
  try {
    workspacesList = await makeApiRequest(req_options);
  } catch {
    throw new Error('Error when trying to send requests to the API Gateway. Make sure defined properly your test configuration in ./load-test-workspaces.config.js');
  }
  if (!Array.isArray(JSON.parse(workspacesList.body))) {
    throw new Error(`Error when fetching the eligible list of workspaces : your token might not be unauthorized. response.body: ${workspacesList.body}`);
  }

  // Keep on only the test workspaces satisfying the filters
  const workspaces = JSON.parse(workspacesList.body).filter((workspace) => {
    if (!workspace.name.includes(config.TEST_NAME_PREFIX)) { return false; }
    else if (!status.includes(workspace.status)) { return false; }
    else if (projectName && workspace.projectId !== projectName) { return false; }
    else if (type && workspace.instanceInfo.type !== type) { return false; }
    else if (size && workspace.instanceInfo.size !== size) { return false; }
    return true;
  });

  // If a count is specified keep the right number of elegible workspaces
  if (count && workspaces.length > count) {
    workspaces.splice(0, workspaces.length - count);
  }
  console.log(`Found ${workspaces.length} eligible workspaces.`);
  return workspaces;
}

async function main() {
  try {
    console.log('\n\n ---- BEGIN LOAD TESTING ----\n');
    var workspaces;
    var statusFilter;
    switch (OPERATION) {
      case 'create':
        await loadTest_createWorkspaces(config.BASIC_REQ_OPTIONS, config.PROJECT_NAME, argv.nb || 1, argv.type || 'rstudio', argv.size || config.DEFAULT_SIZE[argv.type || 'rstudio']);
        break;
      case 'access':
        workspaces = await fetchTestWorkspacesFilteredList(config.BASIC_REQ_OPTIONS, config.PROJECT_NAME, argv.nb, argv.type, argv.size);
        await loadTest_accessWorkspaces(config.BASIC_REQ_OPTIONS, workspaces);
        break;
      case 'terminate':
        statusFilter = ['STOPPED', 'COMPLETED', 'TERMINATING_FAILED'];
        workspaces = await fetchTestWorkspacesFilteredList(config.BASIC_REQ_OPTIONS, config.PROJECT_NAME, argv.nb, argv.type, argv.size, status = statusFilter);
        await loadTest_terminateWorkspaces(config.BASIC_REQ_OPTIONS, workspaces);
        break;
      case 'delete':
        statusFilter = ['TERMINATED', 'FAILED'];
        workspaces = await fetchTestWorkspacesFilteredList(config.BASIC_REQ_OPTIONS, config.PROJECT_NAME, argv.nb, argv.type, argv.size, status = statusFilter);
        await load_test_removeWorkspacesFromDB(workspaces, config.TABLE_NAME, config.REGION_NAME);
        break;
      case 'start':
        statusFilter = ['STOPPED', 'TERMINATING_FAILED'];
        workspaces = await fetchTestWorkspacesFilteredList(config.BASIC_REQ_OPTIONS, config.PROJECT_NAME, argv.nb, argv.type, argv.size, status = statusFilter);
        await loadTest_toggleWorkspaces(config.BASIC_REQ_OPTIONS, workspaces, 'start');
        break;
      case 'stop':
        workspaces = await fetchTestWorkspacesFilteredList(config.BASIC_REQ_OPTIONS, config.PROJECT_NAME, argv.nb, argv.type, argv.size);
        await loadTest_toggleWorkspaces(config.BASIC_REQ_OPTIONS, workspaces, 'stop');
        break;
      default:
        console.error('Wrong command line arguments. Please type node load-test-workspace.js --help for usage details.');
        console.error(new Error(`Unknown command name or alias : ${argv._[0]}.`));
    }
  } catch (err) {
    console.error(err);
    return;
  }

  console.log('\n---- END LOAD TESTING ----\n');
}

main();