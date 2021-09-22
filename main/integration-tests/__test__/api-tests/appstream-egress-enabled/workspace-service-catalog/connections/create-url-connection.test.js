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

const axios = require('axios').default;
const { runSetup } = require('../../../../../support/setup');

describe('Create URL scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  // These tests assume workspaces have already been created in the SWB environment
  // TODO: Create a new workspace during these tests, and terminate once done (dependent on GALI-1093)
  describe('Create AppStream URL', () => {
    it('should return AppStream URL: SageMaker', async () => {
      // BUILD
      const envId = setup.defaults.sagemakerEnvId;
      const connectionId = 'id-0';
      const applicationName = 'Firefox';
      const sagemakerUrlPrefix = 'https://basicnotebookinstance';
      const preAuthStreamingUrl = 'https://appstream2.us-east-1.aws.amazon.com/authenticate?parameters=';
      const redirectStreamingUrl = `appstream2.us-east-1.aws.amazon.com/#/streaming/?reference=fleet%2Finitial-stack-1629237287942-ServiceWorkbenchFleet&app=${applicationName}`;

      // OPERATE
      const connectionUrlResponse = await adminSession.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(envId)
        .connections()
        .connection(connectionId)
        .createUrl();

      // CHECK
      expect(connectionUrlResponse.appstreamDestinationUrl).toContain(sagemakerUrlPrefix);
      expect(connectionUrlResponse.id).toEqual(connectionId);
      expect(connectionUrlResponse.url).toContain(preAuthStreamingUrl);

      const token = connectionUrlResponse.url.split('parameters=')[1];
      const headers = {
        Authority: 'appstream2.us-east-1.aws.amazon.com',
        Authorization: token,
      };

      // OPERATE
      const axiosClient = axios.create({
        baseURL: connectionUrlResponse.url,
        headers,
      });

      let redirectUrl;
      try {
        await axiosClient.get(connectionUrlResponse.url, {
          withCredentials: true,
        });
      } catch (e) {
        redirectUrl = e.request.res.responseUrl;
      }

      // CHECK
      expect(redirectUrl).toContain(redirectStreamingUrl);
    });

    // Simplify repetitive Jest test cases with it.each here
    const testContexts = [
      [
        'Windows',
        {
          envIdPath: 'windowsEnvId',
          connectionId: 'id-1',
          applicationName: 'MicrosoftRemoteDesktop',
          preAuthStreamingUrl: 'https://appstream2.us-east-1.aws.amazon.com/authenticate?parameters=',
          redirectStreamingUrl:
            'appstream2.us-east-1.aws.amazon.com/#/streaming/?reference=fleet%2Finitial-stack-1629237287942-ServiceWorkbenchFleet&app=',
          expected: { scheme: 'rdp', name: 'RDP to EC2 Windows Instance' },
        },
      ],
      [
        'EC2 Linux',
        {
          envIdPath: 'linuxEnvId',
          connectionId: 'id-1',
          applicationName: 'EC2Linux',
          preAuthStreamingUrl: 'https://appstream2.us-east-1.aws.amazon.com/authenticate?parameters=',
          redirectStreamingUrl:
            'appstream2.us-east-1.aws.amazon.com/#/streaming/?reference=fleet%2Finitial-stack-1629237287942-ServiceWorkbenchFleet&app=',
          expected: { scheme: 'ssh', name: 'SSH to Main EC2 instance' },
        },
      ],
    ];

    it.each(testContexts)('should return AppStream URL: %s', async (_, testContext) => {
      // OPERATE
      const connectionUrlResponse = await adminSession.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(setup.defaults[testContext.envIdPath])
        .connections()
        .connection(testContext.connectionId)
        .createUrl();

      // CHECK
      expect(connectionUrlResponse.scheme).toContain(testContext.expected.scheme);
      expect(connectionUrlResponse.name).toContain(testContext.expected.name);
      expect(connectionUrlResponse.id).toEqual(testContext.connectionId);
      expect(connectionUrlResponse.url).toContain(testContext.preAuthStreamingUrl);

      const token = connectionUrlResponse.url.split('parameters=')[1];
      const headers = {
        Authority: 'appstream2.us-east-1.aws.amazon.com',
        Authorization: token,
      };

      // OPERATE
      const axiosClient = axios.create({
        baseURL: connectionUrlResponse.url,
        headers,
      });

      let redirectUrl;
      try {
        await axiosClient.get(connectionUrlResponse.url, {
          withCredentials: true,
        });
      } catch (e) {
        redirectUrl = e.request.res.responseUrl;
      }

      // CHECK
      expect(redirectUrl).toContain(testContext.redirectStreamingUrl);
    });
  });
});
