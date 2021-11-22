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

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  async function checkAllRstudioWorkspaceIsTerminated() {
    const response = await adminSession.resources.workspaceServiceCatalogs.get();
    const workspaces = response.filter(workspace => {
      return (
        workspace.envTypeId === setup.defaults.envTypes.rstudio.envTypeId &&
        !['TERMINATED', 'FAILED'].includes(workspace.status)
      );
    });
    if (workspaces.length > 0) {
      throw new Error('All RStudio workspaces should be terminated or failed');
    }
  }

  // eslint-disable-next-line jest/expect-expect
  it('should launch a RStudio instance', async () => {
    if (setup.defaults.envTypes.rstudio.envTypeId === 'N/A') {
      return;
    }
    // Putting checkAllRstudioWorkspaceIsTerminated check here, because putting this check in `beforeAll` will not stop executing the test if the check does fail
    // https://github.com/facebook/jest/issues/2713
    await checkAllRstudioWorkspaceIsTerminated();

    const envId = await launchRStudioWorkspace();

    // For installations without AppStream enabled, check that workspace CIDR can be changed
    if (!setup.defaults.isAppStreamEnabled) {
      await checkCIDR(envId);
    }

    // Allow 90 seconds for EC2 to initialize and create SSM parameters
    await sleep(90 * 1000);

    const rstudioServerUrlResponse = await checkConnectionUrlCanBeCreated(envId);
    await checkConnectionUrlNetworkConnectivity(rstudioServerUrlResponse);
    await checkWorkspaceCanBeTerminatedCorrectly(envId);
  });

  async function launchRStudioWorkspace() {
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
    const rstudioServerUrlResponse = await adminSession.resources.workspaceServiceCatalogs
      .workspaceServiceCatalog(envId)
      .connections()
      .connection('id-1')
      .createUrl();
    expect(rstudioServerUrlResponse.url).toBeDefined();
    if (setup.defaults.isAppStreamEnabled) {
      expect(rstudioServerUrlResponse.appstreamDestinationUrl).toBeDefined();
    }

    return rstudioServerUrlResponse;
  }

  async function checkConnectionUrlNetworkConnectivity(rstudioServerUrlResponse) {
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
