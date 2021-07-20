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

import _ from 'lodash';

describe('Launch new workspaces', () => {
  before(() => {
    cy.login('researcher');
    navigateToWorkspaces();
    terminatePrexistingWorkspaces();
  });

  const workspaceConfigs = Cypress.env('workspaces');
  const workspaceTypes = [
    { Sagemaker: workspaceConfigs.sagemaker },
    { EC2Linux: workspaceConfigs.ec2 },
    { EC2Windows: workspaceConfigs.windows },
  ];

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

  it('should launch AppStream instructions correctly', async () => {
    const provisionedWorkspaces = [];

    // Trigger all workspace-type provisioning
    _.map(workspaceTypes, workspaceConfig => {
      const workspaceName = Object.keys(workspaceConfig)[0];
      const provisionedWorkspaceName = launchWorkspace(workspaceConfig[workspaceName], workspaceName);
      provisionedWorkspaces.push(provisionedWorkspaceName);
    });

    // Click on Connections to verify instructions are present
    _.map(provisionedWorkspaces, provisionedWorkspace => {
      checkAppstreamInstructions(provisionedWorkspace);
    });
  });

  const checkAppstreamInstructions = workspaceName => {
    navigateToWorkspaces();

    // Check that the workspace you created got provisioned successfully
    // The Connections component only loads up for workspaces in AVAILABLE state and ready to connect
    cy.contains(workspaceName)
      .parent()
      .get('button')
      .contains('Connections', { timeout: 900000 })
      .click();

    cy.contains(workspaceName)
      .parent()
      .get('[data-testid=appstream-instructions]');
  };

  const launchWorkspace = (workspaceParam, workspaceType) => {
    navigateToWorkspaces();

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

    // Check that the workspace you created gets provisioned
    cy.contains(workspaceName)
      .parent()
      .contains('PENDING', { timeout: 60000 });

    return workspaceName;
  };
});
