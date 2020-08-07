describe('Launch a new sagemaker workspace', () => {
  before(() => {
    cy.login();
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

    cy.get('button[data-testid=create-workspace]').click({ force: true });

    cy.get('[data-testid=env-type-card]')
      .contains(workspaceParam.workspaceTypeName)
      .click();

    cy.get('button')
      .contains('Next')
      .click();

    const randomNumber = Math.floor(Math.random() * 1000);
    const testName = `CypressTest${workspaceType}Workspace-${randomNumber}`;
    cy.get('[data-testid=workspace-name] input').type(testName);

    cy.get('[data-testid=project-id]').click();
    cy.get('[data-testid=project-id]')
      .find('.selected')
      .contains(workspaceParam.projectId)
      .click();

    cy.get('[data-testid=configuration-card]')
      .contains(workspaceParam.configuration)
      .click();

    cy.get('[data-testid=description-text-area]').type(`Cypress description-${randomNumber}`);

    cy.get('button')
      .contains('Create Research Workspace')
      .click();

    cy.contains(testName)
      .parent()
      .contains('PENDING');
  };
});
