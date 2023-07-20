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
  checkWorkspaceAvailable,
  checkWorkspaceAutoStop
} from '../../support/workspace-util';

describe('Launch a workspace', () => {
  before(() => {
    cy.login('researcher');
    navigateToWorkspaces();
    terminateWorkspaces();
  });
  after(() => {
    terminateWorkspaces();
  });

  // Do RStudio create first as we need to test when this becomes available as well
  it('should launch a new RStudio Server workspace correctly', () => {
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    const workspaces = Cypress.env('workspaces');
    const rstudioServer = workspaces.rstudioServer;
    const workspaceName = launchWorkspace(rstudioServer, 'RStudio-Server');
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailable(workspaceName);
  });

  it('should launch a new sagemaker workspace and auto-stops correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const sagemaker = workspaces.sagemaker;
    const workspaceName = launchWorkspace(sagemaker, 'Sagemaker');
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailable(workspaceName);

    // Sagemaker workspace type config has been updated to auto-stop instances after 3 minutes
    checkWorkspaceAutoStop(workspaceName);
  });

  it('should launch a new ec2 Linux workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2 = workspaces.ec2;
    const workspaceName = launchWorkspace(ec2.linux, 'Linux');
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailable(workspaceName);
  });

  it('should launch a new ec2 Windows workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2 = workspaces.ec2;
    const workspaceName = launchWorkspace(ec2.windows, 'Windows');
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailable(workspaceName);
  });

  it('should launch a new emr workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const emr = workspaces.emr;
    const workspaceName = launchWorkspace(emr, 'EMR');
    checkDetailsTable(workspaceName);
    checkWorkspaceAvailable(workspaceName, 2000000);
  });
});
