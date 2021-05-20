describe('studies', () => {
  const studies = Cypress.env('studies');
  const navigateToStudies = () => {
    cy.get('.left.menu')
      .contains('Studies')
      .click();
  };

  const clickOnStudyPermission = studyName => {
    cy.get("div[data-testid='studies-table'] div[data-testid='study-card']")
      .contains(studyName)
      .parents("div[data-testid='study-card']")
      .contains('Permissions')
      .click();
  };
  it('should only allow Study Admin to access study permissions', () => {
    cy.login('researcher');

    navigateToStudies();

    // Click on organization tab
    cy.get("div[data-testid='studies-table'] a[data-testid='table-tab']")
      .contains('Organization')
      .click();

    // Click on Study in which researcher is NOT Study Admin
    const studyThatResearcherIsNotStudyAdmin = studies.organizations.find(study => {
      return study.researcherIsAdmin === false;
    }).name;
    clickOnStudyPermission(studyThatResearcherIsNotStudyAdmin);
    cy.get("div[data-testid='unable-to-access-permission']");

    // Click on Study in which researcher IS Study Admin
    const studyThatResearcherIsStudyAdmin = studies.organizations.find(study => {
      return study.researcherIsAdmin;
    }).name;
    clickOnStudyPermission(studyThatResearcherIsStudyAdmin);
    cy.get("table[data-testid='edit-permission-table']");
  });
});
