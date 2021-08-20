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

import { terminatePreExistingWorkspaces, launchWorkspace, navigateToWorkspaces } from '../../support/workspace-util';

describe('Launch a new workspace', () => {
  before(() => {
    cy.login('researcher');
    navigateToWorkspaces();
    terminatePreExistingWorkspaces();
  });

  it('should launch a new sagemaker workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const sagemaker = workspaces.sagemaker;
    const workspaceName = launchWorkspace(sagemaker, 'Sagemaker');

    // const workspaceName = 'CypressTestSagemakerWorkspace-811';
    cy.contains(workspaceName)
      .parent()
      .contains('AVAILABLE', { timeout: 900000 });
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=sc-environment-connection-button]')
      .click();
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=sc-environment-generate-url-button]', { timeout: 60000 })
      .click();

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

    cy.window()
      .its('open')
      .should('be.called');
  });

  /**
   * This test checks that the connection library we're using works correctly.
   */
  it('checkConnection should work correctly', () => {
    // 8.8.8.8 is Google's DNS server
    cy.exec(`node checkConnection.js 8.8.8.8 443`)
      .its('stdout')
      .should('equal', 'true');
  });

  it('should launch a new linux workspace correctly', () => {
    // const workspaces = Cypress.env('workspaces');
    // const linux = workspaces.ec2.linux;
    // const workspaceName = launchWorkspace(linux, 'Linux');
    const workspaceName = 'CypressTestLinuxWorkspace-517';

    cy.contains(workspaceName)
      .parent()
      .contains('AVAILABLE', { timeout: 900000 });
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=sc-environment-connection-button]')
      .click();
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=use-ssh-key-button]')
      .click();

    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=host-ip]')
      .invoke('text')
      .then(ipAddress => {
        const port = 22;
        cy.exec(`node checkConnection.js ${ipAddress} ${port}`)
          .its('stdout')
          .should('equal', 'false');
      });

    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=connect-to-workspace-button]')
      .click();

    cy.window()
      .its('open')
      .should('be.called');
  });

  it('should launch a new windows workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const linux = workspaces.ec2.linux;
    const workspaceName = launchWorkspace(linux, 'Linux');
    // const workspaceName = 'windows-1';

    cy.contains(workspaceName)
      .parent()
      .contains('AVAILABLE', { timeout: 900000 });
    cy.contains(workspaceName)
      .parent()
      .find('[data-testid=sc-environment-connection-button]')
      .click();
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

    cy.window()
      .its('open')
      .should('be.called');
  });
});
