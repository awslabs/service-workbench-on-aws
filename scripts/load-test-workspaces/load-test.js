#!/usr/bin/env node

const { makeApiRequest } = require("./utils/helper-requests");
const {
  parseCLIArguments,
  validateCLIArguments,
} = require("./utils/helper-cli");
const { updateWorkspacesCatalogue } = require("./utils/update-catalogue");
const { cleanUpTestWorkspacesFromDB } = require("./utils/clean-database");
const { logResponses } = require("./utils/helper-logger");
const config = require("./config/test-config");

// ==============================================================================================================================
//  MAIN FUNCTION
// ==============================================================================================================================

/**
 * This Node script aims at enabling a developer to perform load & scalability tests for the function creating/starting/terminating/... the workspaces
 * @Required
 *  - Set up the config file : ./config/test-config.js
 *  - You need to retrieve a user token to get the authorization to perform such requests.
 * @Optional If you want to remove all traces of the test workspaces created by this script, you will need to get your AWS credentials available for your terminal session.
 * @Usage
 *  - Get help on how to run the script : $ node load-test.js help'
 *  - Create 5 Small Sagemaker workspaces : $ node load-test.js create --count 5 --platform sagemaker-1 --config sagemaker__small
 *  - Access all workspaces from the platform RStudio : $ node load-test.js access --platform rstudio
 *  - Terminate all test Workspaces : $ node load-test.js terminate
 *  - Remove all terminated test workspaces from the Dynamo Db Table : $node load-test.js delete
 */

async function main() {
  // Parse the command line
  let argv;
  try {
    argv = parseCLIArguments();
    validateCLIArguments(argv);
  } catch (err) {
    console.error(
      'Wrong command line. Please type "node load-test.js help" for usage details.'
    );
    console.error(`${err.message}\n`);
    return;
  }
  const COMMAND = argv._[0];

  // Run the test command
  try {
    console.log("\n\n------- BEGIN LOAD TESTING -------\n");

    let workspaces;
    let statusFilter;
    switch (COMMAND) {
      case "create":
        await createWorkspaces(
          config.BASIC_REQ_OPTIONS,
          config.PROJECT_NAME,
          argv.count,
          argv.platform,
          argv.config
        );
        break;
      case "access":
        workspaces = await fetchEligibleWorkspaces(
          config.BASIC_REQ_OPTIONS,
          config.PROJECT_NAME,
          argv.count,
          argv.platform,
          argv.config
        );
        await accessWorkspaces(config.BASIC_REQ_OPTIONS, workspaces);
        break;
      case "terminate":
        statusFilter = ["STOPPED", "COMPLETED", "TERMINATING_FAILED"];
        workspaces = await fetchEligibleWorkspaces(
          config.BASIC_REQ_OPTIONS,
          config.PROJECT_NAME,
          argv.count,
          argv.platform,
          argv.config,
          statusFilter
        );
        await terminateWorkspaces(config.BASIC_REQ_OPTIONS, workspaces);
        break;
      case "delete":
        statusFilter = ["TERMINATED"];
        workspaces = await fetchEligibleWorkspaces(
          config.BASIC_REQ_OPTIONS,
          config.PROJECT_NAME,
          argv.count,
          argv.platform,
          argv.config,
          statusFilter
        );
        await cleanUpTestWorkspacesFromDB(
          workspaces,
          config.TABLE_NAME,
          config.REGION_NAME
        );
        break;
      case "start":
        statusFilter = ["STOPPED", "TERMINATING_FAILED"];
        workspaces = await fetchEligibleWorkspaces(
          config.BASIC_REQ_OPTIONS,
          config.PROJECT_NAME,
          argv.count,
          argv.platform,
          argv.config,
          statusFilter
        );
        await toggleWorkspaces(config.BASIC_REQ_OPTIONS, workspaces, "start");
        break;
      case "stop":
        statusFilter = ["COMPLETED"];
        workspaces = await fetchEligibleWorkspaces(
          config.BASIC_REQ_OPTIONS,
          config.PROJECT_NAME,
          argv.count,
          argv.platform,
          argv.config
        );
        await toggleWorkspaces(config.BASIC_REQ_OPTIONS, workspaces, "stop");
        break;
      case "update-catalogue":
        await updateWorkspacesCatalogue(config.BASIC_REQ_OPTIONS);
        break;
      default:
        console.error(
          "Wrong command line arguments. Please type node load-test.js help for usage details."
        );
        console.error(
          new Error(`Unknown command name or alias : ${argv._[0]}.`)
        );
    }
  } catch (err) {
    console.error(err);
    return;
  }

  console.log("\n-------  END LOAD TESTING  -------\n\n");
}

async function fetchEligibleWorkspaces(
  options,
  projectName,
  count,
  platform,
  conf,
  status = ["COMPLETED"]
) {
  console.log(
    `Fetching ${count ? `${count} ` : ""}eligible workspaces. Filters: ${
      projectName ? `[project-name = ${projectName}],` : ""
    }${platform ? `[platform = ${platform}],` : ""}${
      conf ? `[config = ${conf}],` : ""
    }${status ? `[status = ${status}]` : ""}`
  );

  const request = {
    ...options,
    path: `${options.path}/workspaces`,
    method: "GET",
  };

  let workspacesList;
  try {
    workspacesList = await makeApiRequest(request);
  } catch (err) {
    throw new Error(
      `${
        "Error when trying to send requests to the API Gateway.\n" +
        "Also make sure you defined properly your test configuration in ./config/test-config.js\n"
      }${err}`
    );
  }
  if (!Array.isArray(JSON.parse(workspacesList.body))) {
    throw new Error(
      `Error when fetching the eligible list of workspaces : your api token might not be authorized. response.body: ${workspacesList.body}\n` +
        `Also make sure you defined properly your test configuration in ./config/test-config.js`
    );
  }

  // Keep on only the test workspaces satisfying the filters
  const workspaces = JSON.parse(workspacesList.body).filter((workspace) => {
    if (!workspace.name.includes(config.TEST_NAME_PREFIX)) {
      return false;
    }
    if (!status.includes(workspace.status)) {
      return false;
    }
    if (projectName && workspace.projectId !== projectName) {
      return false;
    }
    if (platform && workspace.platformId !== platform) {
      return false;
    }
    if (conf && workspace.configurationId !== conf) {
      return false;
    }
    return true;
  });

  // If a count is specified keep the right number of elegible workspaces
  if (count && workspaces.length > count) {
    workspaces.splice(0, workspaces.length - count);
  }
  console.log(`Found ${workspaces.length} eligible workspaces.`);
  return workspaces;
}

// ==============================================================================================================================
//  LOAD TEST - CREATE WORKSPACES
// ==============================================================================================================================

async function createWorkspaces(options, projectName, count, platform, conf) {
  const request = {
    ...options,
    path: `${options.path}/workspaces`,
    method: "POST",
  };

  const params = await setConfigurationParams(options, platform);
  const payloads = [...Array(count)].map((_, index) => {
    return JSON.stringify({
      name: `${config.TEST_NAME_PREFIX}-${platform.toUpperCase()}-${index + 1}`,
      description: `Load test workspace [${platform}] ${conf} - (${index + 1})`,
      projectId: projectName,
      configurationId: conf,
      params,
      platformId: platform,
      studyIds: [],
    });
  });

  const workspacesList = [];
  const promises = [];
  for (let i = 0; i < payloads.length; i += 1) {
    const payload = payloads[i];
    console.log(`Creating ${JSON.parse(payload).name} ...`);
    workspacesList.push({ name: JSON.parse(payload).name });
    const promise = makeApiRequest(request, payload);
    promises.push(promise);
  }

  // Wait for the resolution of all the requests
  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

async function setConfigurationParams(options, platform) {
  const params = {};

  // Add CIDR param required for the creation of EC2-based workspaces
  if (["ec2-linux-1", "ec2-windows-1", "emr-1"].includes(platform)) {
    const request = {
      ...options,
      path: `${options.path}/ip`,
      method: "GET",
    };
    const response = await makeApiRequest(request);
    const ip = JSON.parse(response.body).ipAddress;
    if (ip === undefined) {
      throw new Error(
        "Error when reaching out to the API. Make sure your API_TOKEN is not expired."
      );
    }
    params.cidr = `${ip}/32`;
  }
  return params;
}

// ==============================================================================================================================
//  LOAD TEST - ACCESS WORKSPACES
// ==============================================================================================================================

async function accessWorkspaces(options, workspacesList) {
  // Send requests to simulate the access to those workspaces
  const promises = [];
  workspacesList.forEach((workspace) => {
    console.log(
      `Accessing ${workspace.name} (${workspace.platformId})(${workspace.configurationId}) ...`
    );
    switch (workspace.platformId) {
      default:
        console.log(
          `---> TODO : simulate access to workspaces of platform : ${workspace.platformId}`
        );
    }
  });

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

// ==============================================================================================================================
//  LOAD TEST - START OR STOP WORKSPACES
// ==============================================================================================================================

async function toggleWorkspaces(options, workspacesList, command) {
  const request = {
    ...options,
    method: "PUT",
  };

  const promises = [];
  workspacesList.forEach((workspace) => {
    console.log(
      `${command === "start" ? "Starting" : "Stopping"} ${workspace.name} (id:${
        workspace.id
      }) ...`
    );
    request.path = `${options.path}/workspaces/${workspace.id}/${command}`;
    promises.push(makeApiRequest(request));
  });

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

// ==============================================================================================================================
//  LOAD TEST - TERMINATE WORKSPACES
// ==============================================================================================================================

async function terminateWorkspaces(options, workspacesList) {
  const request = {
    ...options,
    method: "DELETE",
  };

  // Send requests to simulate the access to those workspaces
  const promises = [];
  for (let i = 0; i < workspacesList.length; i += 1) {
    const workspace = workspacesList[i];
    console.log(`Terminating ${workspace.name} (id:${workspace.id}) ...`);
    request.path = `${options.path}/workspaces/${workspace.id}`;
    const promise = makeApiRequest(request);
    promises.push(promise);
  }

  const responses = await Promise.all(promises);
  logResponses(responses, workspacesList);
}

main();
