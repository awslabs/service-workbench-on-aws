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

const fetch = require('node-fetch');
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
    it('should return AppStream URL SageMaker', async () => {
      const envId = '36f22de5-fefb-4f62-8ab4-e99ac4387ad4';
      const connectionId = 'id-0';
      const applicationName = 'Firefox';
      const sagemakerUrlPrefix = 'https://basicnotebookinstance';
      const preAuthStreamingUrl = 'https://appstream2.us-east-1.aws.amazon.com/authenticate?parameters=';
      const redirectStreamingUrl = `appstream2.us-east-1.aws.amazon.com/#/streaming/?reference=fleet%2Finitial-stack-1629237287942-ServiceWorkbenchFleet&app=${applicationName}`;

      const retVal = await adminSession.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(envId)
        .connections()
        .connection(connectionId)
        .createUrl();

      const response = await fetch(retVal.url);
      const redirectResponse = response[Object.getOwnPropertySymbols(response)[1]];

      expect(retVal.appstreamDestinationUrl).toContain(sagemakerUrlPrefix);
      expect(retVal.id).toEqual(connectionId);
      expect(retVal.url).toContain(preAuthStreamingUrl);
      expect(redirectResponse.url).toContain(redirectStreamingUrl);
    });

    // Simplify repetitive Jest test cases with it.each here
    const testContexts = [
      [
        'Windows',
        {
          envId: '5360d995-fa4b-44eb-b67d-a0586886e1a3',
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
          envId: '4ceb23c8-c80c-4ded-b948-c63b21ba5c72',
          connectionId: 'id-1',
          applicationName: 'EC2Linux',
          preAuthStreamingUrl: 'https://appstream2.us-east-1.aws.amazon.com/authenticate?parameters=',
          redirectStreamingUrl:
            'appstream2.us-east-1.aws.amazon.com/#/streaming/?reference=fleet%2Finitial-stack-1629237287942-ServiceWorkbenchFleet&app=',
          expected: { scheme: 'ssh', name: 'SSH to Main EC2 instance' },
        },
      ],
    ];

    it.each(testContexts)('should return AppStream URL %s', async (_, testContext) => {
      const retVal = await adminSession.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(testContext.envId)
        .connections()
        .connection(testContext.connectionId)
        .createUrl();

      const response = await fetch(retVal.url);
      const redirectResponse = response[Object.getOwnPropertySymbols(response)[1]];

      expect(retVal.scheme).toContain(testContext.expected.scheme);
      expect(retVal.name).toContain(testContext.expected.name);
      expect(retVal.id).toEqual(testContext.connectionId);
      expect(retVal.url).toContain(testContext.preAuthStreamingUrl);
      expect(redirectResponse.url).toContain(`${testContext.redirectStreamingUrl}${testContext.applicationName}`);
    });
  });
});
