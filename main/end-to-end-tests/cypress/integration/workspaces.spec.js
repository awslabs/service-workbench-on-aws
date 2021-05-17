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

describe('Launch a new sagemaker workspace', () => {
  before(() => {
    cy.login('researcher');
    navigateToWorkspaces();
    terminatePrexistingWorkspaces();
  });

  const navigateToWorkspaces = () => {
    cy.get('.left.menu')
      .contains('Workspaces')
      .click();
    cy.get('[data-testid=workspaces]');
  };

  const terminatePrexistingWorkspaces = () => {
    cy.get('#root').then($body => {
      if ($body.find('[data-testid=sc-env-terminate]').length > 0) {
        cy.get('#root')
          .find('[data-testid=sc-env-terminate]')
          .each($el => {
            cy.wrap($el).click();
            cy.get('.modals')
              .contains('Terminate')
              .click();
          });
      }
    });
  };

  it('should launch a new sagemaker workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const sagemaker = workspaces.sagemaker;
    launchWorkspace(sagemaker, 'Sagemaker');
  });

  it('should launch a new ec2 workspace correctly', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2 = workspaces.ec2;
    launchWorkspace(ec2, 'EC2');
  });

  const launchWorkspace = (workspaceParam, workspaceType) => {
    navigateToWorkspaces();

    cy.get('[data-testid=workspaces]');

    // Click create new workspace button
    cy.get('button[data-testid=create-workspace]').click({ force: true });

    // Select the type of environment you want to launch
    cy.get('[data-testid=env-type-card]')
      .contains(workspaceParam.workspaceTypeName)
      .click();

    // Click next
    cy.get('button')
      .contains('Next')
      .click();

    // Specify the name for the workspace
    const randomNumber = Math.floor(Math.random() * 1000);
    const workspaceName = `CypressTest${workspaceType}Workspace-${randomNumber}`;
    cy.get('[data-testid=workspace-name] input').type(workspaceName);

    // Select project id
    cy.get('[data-testid=project-id]').click();
    cy.get('[data-testid=project-id]')
      .find('.item')
      .contains(workspaceParam.projectId)
      .click();

    // Select workspace configuration card
    cy.get('[data-testid=configuration-card]')
      .contains(workspaceParam.configuration)
      .click();

    // Specify name for workspace
    cy.get('[data-testid=description-text-area]').type(`Cypress description-${randomNumber}`);

    // Create the workspace
    cy.get('button')
      .contains('Create Research Workspace')
      .click();

    // Check that the workspace you created is in PENDING mode
    cy.contains(workspaceName)
      .parent()
      .contains('PENDING', { timeout: 600000 });
  };
});
