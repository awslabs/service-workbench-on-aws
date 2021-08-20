function terminatePreExistingWorkspaces() {
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
}

function launchWorkspace(workspaceParam, workspaceType) {
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

  return workspaceName;
}

function navigateToWorkspaces() {
  cy.get('.left.menu')
    .contains('Workspaces')
    .click();
  cy.get('[data-testid=workspaces]');
}

module.exports = {
  terminatePreExistingWorkspaces,
  launchWorkspace,
  navigateToWorkspaces,
};
