/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const { sleep } = require('@aws-ee/base-services/lib/helpers/utils');
const axios = require('axios').default;
const { runSetup } = require('../../../../../support/setup');
const { deleteWorkspaceServiceCatalog } = require('../../../../../support/complex/delete-workspace-service-catalog');

describe('Launch and terminate RStudio instance', () => {
  let setup;
  let adminSession;

  beforeEach(async () => {
    await terminateAllRStudioWorkspaces();
    await checkAllRstudioWorkspaceIsTerminated();
  });

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  async function checkAllRstudioWorkspaceIsTerminated() {
    console.log('Check all RStudio Workspaces are terminated');
    let response = await adminSession.resources.workspaceServiceCatalogs.get();
    const rstudioEnvTypeId = setup.defaults.envTypes.rstudio.envTypeId;
    let workspaces = response.filter(workspace => {
      return workspace.envTypeId === rstudioEnvTypeId && !['TERMINATED', 'FAILED'].includes(workspace.status);
    });
    const maxWaitTimeInSeconds = 600;
    const startTime = Date.now();
    while (Date.now() - startTime <= maxWaitTimeInSeconds * 1000 && workspaces.length > 0) {
      // Sleep for 10 seconds
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, 10000));
      // eslint-disable-next-line no-await-in-loop
      response = await adminSession.resources.workspaceServiceCatalogs.get();
      workspaces = response.filter(workspace => {
        return workspace.envTypeId === rstudioEnvTypeId && !['TERMINATED', 'FAILED'].includes(workspace.status);
      });

      console.log(
        'Workspaces that are not terminated. Ids: ',
        workspaces.map(workspace => {
          return workspace.id;
        }),
      );
    }
    if (workspaces.length > 0) {
      throw new Error('All RStudio workspaces should be terminated or failed');
    }
  }

  async function terminateAllRStudioWorkspaces() {
    const response = await adminSession.resources.workspaceServiceCatalogs.get();
    const rstudioEnvTypeId = setup.defaults.envTypes.rstudio.envTypeId;
    const nonTerminatedWorkspaces = response.filter(workspace => {
      return workspace.envTypeId === rstudioEnvTypeId && ['COMPLETED', 'STOPPED'].includes(workspace.status);
    });
    console.log('Non Terminated workspaces', nonTerminatedWorkspaces);
    for (let i = 0; i < nonTerminatedWorkspaces.length; i += 1) {
      console.log(`Terminating ${nonTerminatedWorkspaces[i].id}`);
      // eslint-disable-next-line no-await-in-loop
      await adminSession.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(nonTerminatedWorkspaces[i].id)
        .delete();
    }
  }

  // eslint-disable-next-line jest/expect-expect
  it('should launch a RStudio instance', async () => {
    if (setup.defaults.envTypes.rstudio.envTypeId === 'N/A') {
      return;
    }

    const envId = await launchRStudioWorkspace();

    // For installations without AppStream enabled, check that workspace CIDR can be changed
    if (!setup.defaults.isAppStreamEnabled) {
      await checkCIDR(envId);
    }

    const rstudioServerUrlResponse = await checkConnectionUrlCanBeCreated(envId);
    await checkConnectionUrlNetworkConnectivity(rstudioServerUrlResponse);
    await checkWorkspaceCanBeTerminatedCorrectly(envId);
  });

  async function launchRStudioWorkspace() {
    console.log('Launch RStudio Workspace');
    const workspaceName = setup.gen.string({ prefix: 'launch-studio-workspace-test' });
    const createWorkspaceBody = {
      name: workspaceName,
      envTypeId: setup.defaults.envTypes.rstudio.envTypeId,
      envTypeConfigId: setup.defaults.envTypes.rstudio.envTypeConfigId,
      studyIds: [],
      description: 'test',
      projectId: setup.defaults.project.id,
    };
    if (!setup.defaults.isAppStreamEnabled) {
      createWorkspaceBody.cidr = '0.0.0.0/24';
    }
    const env = await adminSession.resources.workspaceServiceCatalogs.create(createWorkspaceBody);
    await sleep(2000);
    await adminSession.resources.workflows
      .versions('wf-provision-environment-sc')
      .version(1)
      .findAndPollWorkflow(env.id, 10000, 90);
    return env.id;
  }

  async function checkCIDR(envId) {
    console.log('Check CIDR');
    const cidrs = {
      cidr: [
        {
          protocol: 'tcp',
          fromPort: 22,
          toPort: 22,
          cidrBlocks: ['0.0.0.0/32'],
        },
        {
          protocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrBlocks: ['0.0.0.0/32'],
        },
        {
          protocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrBlocks: ['0.0.0.0/32'],
        },
      ],
    };
    await expect(
      adminSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(envId).cidr(cidrs),
    ).resolves.toBeDefined();
  }

  async function checkWorkspaceCanBeTerminatedCorrectly(envId) {
    console.log('Check workspace can be terminated correctly');
    await adminSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(envId).delete();
    await sleep(2000);
    await adminSession.resources.workflows
      .versions('wf-terminate-environment-sc')
      .version(1)
      .findAndPollWorkflow(envId, 10000, 35);

    const envState = await adminSession.resources.workspaceServiceCatalogs.workspaceServiceCatalog(envId).get();

    // Check that workspace terminated correctly
    expect(envState.status).toEqual('TERMINATED');
    await deleteWorkspaceServiceCatalog({ aws: setup.aws, id: envId });
  }

  async function checkConnectionUrlCanBeCreated(envId) {
    console.log('Check Connection URL can be created');
    // Wait for a maximum of 360 seconds for RStudio Connection URL
    const maxWaitTimeInSeconds = 360;
    const startTime = Date.now();
    await sleep(90 * 1000);

    const isUrlDefined = urlResponse => {
      if (setup.defaults.isAppStreamEnabled) {
        return urlResponse.appstreamDestinationUrl !== undefined;
      }
      return urlResponse.url !== undefined;
    };

    let rstudioServerUrlResponse = {};
    rstudioServerUrlResponse = await getRStudioConnectionUrl(envId);
    while (Date.now() - startTime <= maxWaitTimeInSeconds * 1000 && !isUrlDefined(rstudioServerUrlResponse)) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(90 * 1000);
      console.log('rstudioServerUrlResponse', rstudioServerUrlResponse);
      console.log('Sleeping for 90 seconds and trying to get RStudio Connection URL again');
      // eslint-disable-next-line no-await-in-loop
      rstudioServerUrlResponse = await getRStudioConnectionUrl(envId);
    }

    expect(isUrlDefined(rstudioServerUrlResponse)).toBeTruthy();

    return rstudioServerUrlResponse;
  }

  async function getRStudioConnectionUrl(envId) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return adminSession.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(envId)
        .connections()
        .connection('id-1')
        .createUrl();
    } catch (e) {
      console.log('Failed to get RStudio URL', e);
    }
    return {};
  }

  async function checkConnectionUrlNetworkConnectivity(rstudioServerUrlResponse) {
    console.log('Check Connection URL network connectivity');
    if (!setup.defaults.isAppStreamEnabled) {
      // VERIFY active workspaces are associated with unexpired TLSv1.2 certs
      // By default Axios verify that the domain's SSL cert is valid. If we're able to get a response from the domain it means the domain's cert is valid
      // Getting a 403 response code is expected because our client's IP address is not whitelisted to access the RStudio server
      const url = rstudioServerUrlResponse.url;
      await expect(axios.get(url)).rejects.toThrow('Request failed with status code 403');
    } else {
      // If AppStream is enabled, we should not be able to access the RStudio url from the internet
      const url = rstudioServerUrlResponse.appstreamDestinationUrl;
      await expect(axios.get(url)).rejects.toThrow(/getaddrinfo ENOTFOUND .*/);
    }
  }
});
