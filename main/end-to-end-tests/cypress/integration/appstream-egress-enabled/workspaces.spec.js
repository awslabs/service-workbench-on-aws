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

import {
  terminateWorkspaces,
  launchWorkspace,
  navigateToWorkspaces,
  checkDetailsTable,
} from '../../support/workspace-util';

describe('Launch new workspaces', () => {
  before(() => {
    cy.login('researcher');
    navigateToWorkspaces();
    terminateWorkspaces();
  });
  after(() => {
    terminateWorkspaces();
  });

  let expectedNumberOfNewlyOpenBrowserWindows = 0;

  it('should launch Sagemaker, Linux, and Windows successfully', () => {
    const workspaces = Cypress.env('workspaces');
    const sagemakerWorkspaceName = launchWorkspace(workspaces.sagemaker, 'Sagemaker');
    const linuxWorkspaceName = launchWorkspace(workspaces.ec2.linux, 'Linux');
    const windowsWorkspaceName = launchWorkspace(workspaces.ec2.windows, 'Windows');

    checkSagemaker(sagemakerWorkspaceName);
    checkLinux(linuxWorkspaceName);
    checkWindows(windowsWorkspaceName);

    // Each time we click the "Connect" button on a workspace, it should open a new browser window connected to an AppStream instance.
    // Let's check the expected number of new browser windows are opened
    cy.window()
      .its('open')
      .should('have.callCount', expectedNumberOfNewlyOpenBrowserWindows);
  });

  function checkWindows(workspaceName) {
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailableAndClickConnectionsButton(workspaceName);
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=get-password-button]')
      .click();

    // For Windows workspace, we do not return an IP Address that can be tested for internet connectivity. Therefore
    // we will just check that a new tab is opened for AppStream
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=connect-to-workspace-button]')
      .click();
    expectedNumberOfNewlyOpenBrowserWindows += 1;
  }

  function checkLinux(workspaceName) {
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailableAndClickConnectionsButton(workspaceName);
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=use-ssh-key-button]')
      .click();

    // Check we can not access the Linux url from the internet.  Note Linux url is different from AppStream Url. To access Linux
    // we would do it through the AppStream Url
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=host-ip]')
      .invoke('text')
      .then(ipAddress => {
        const port = 22;
        cy.exec(`node checkConnection.js ${ipAddress} ${port}`, { failOnNonZeroExit: false })
          .its('code')
          .should('equal', 1);
      });

    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=connect-to-workspace-button]')
      .click();
    expectedNumberOfNewlyOpenBrowserWindows += 1;
  }

  function checkSagemaker(workspaceName) {
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailableAndClickConnectionsButton(workspaceName);
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=sc-environment-generate-url-button]', { timeout: 60000 })
      .click();

    // Check we can not access Sagemaker url from the internet. Note Sagemaker url is different from AppStream Url. To access Sagemaker
    // we would do it through the AppStream Url
    cy.get('[data-testid=destination-url]')
      .invoke('text')
      .then(url => {
        cy.request({ url, failOnStatusCode: false }).then(response => {
          expect(response.status).to.equal(403);
        });
      });

    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=connect-to-workspace-button]')
      .click();
    expectedNumberOfNewlyOpenBrowserWindows += 1;
  }

  function checkWorkspaceAvailableAndClickConnectionsButton(workspaceName) {
    cy.contains(workspaceName)
      .parent()
      .contains('AVAILABLE', { timeout: 900000 });
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=sc-environment-connection-button]')
      .click();
  }

  /**
   * This test checks that the connection library we're using works correctly.
   */
  it('checkConnection should work correctly', () => {
    // 8.8.8.8 is Google's DNS server
    cy.exec(`node checkConnection.js 8.8.8.8 443`)
      .its('code')
      .should('equal', 0);
  });
});
