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
  checkWorkspaceAvailableAndClickConnectionsButton,
} from '../../support/workspace-util';

describe('Launch a workspace', () => {
  before(() => {
    cy.login('researcher');
    navigateToWorkspaces();
    terminateWorkspaces();
  });

  // Do RStudio create first as we need to test when this becomes available as well
  it('should launch a new RStudio Server workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const rstudioServer = workspaces.rstudioServer;
    const workspaceName = launchWorkspace(rstudioServer, 'RStudio-Server');
    checkDetailsTable(workspaceName);
  });

  it('should launch a new sagemaker workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const sagemaker = workspaces.sagemaker;
    const workspaceName = launchWorkspace(sagemaker, 'Sagemaker');
    checkDetailsTable(workspaceName);
  });

  it('should launch a new ec2 Linux workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2 = workspaces.ec2;
    const workspaceName = launchWorkspace(ec2.linux, 'Linux');
    checkDetailsTable(workspaceName);
  });

  it('should launch a new ec2 Windows workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2 = workspaces.ec2;
    const workspaceName = launchWorkspace(ec2.windows, 'Windows');
    checkDetailsTable(workspaceName);
  });

  it('should launch a new emr workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const emr = workspaces.emr;
    const workspaceName = launchWorkspace(emr, 'EMR');
    checkDetailsTable(workspaceName);
  });

  it('should have opened a new tab for the RStudio Server when you click Connect', () => {
    // Need to login at the beginning so the stub is initialized directly before we use to monitor the new tab opening
    cy.login('researcher');
    navigateToWorkspaces();
    // Check that the RStudio Server workspace is in available status
    checkWorkspaceAvailableAndClickConnectionsButton('CypressTestRStudio-ServerWorkspace-');
    // Click connect
    cy.contains('CypressTestRStudio-ServerWorkspace-')
      .parent()
      .find('[data-testid=connect-to-workspace-button]')
      .click();
    // Each time we click the "Connect" button on a workspace, it should open a new browser window connected to the RStudio server instance.
    // Let's check the expected number of new browser windows are opened
    cy.window()
      .its('open')
      .should('be.called');
    // Click connect
    cy.contains('CypressTestRStudio-ServerWorkspace-')
      .parent()
      .find('[data-testid=connect-to-workspace-button]')
      .click();
  });
});
