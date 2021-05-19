describe('studies', () => {
  const studies = Cypress.env('studies');
  const navigateToStudies = () => {
    cy.get('.left.menu')
      .contains('Studies')
      .click();
  };

  const getOrgStudyPermissions = studyName => {
    cy.login('researcher');
    navigateToStudies();
    cy.get("div[data-testid='studies-table'] a[data-testid='table-tab']")
      .contains('Organization')
      .click();
    cy.get("div[data-testid='studies-table'] div[data-testid='study-card']")
      .contains(studyName)
      .parents("div[data-testid='study-card']")
      .contains('Permissions')
      .click();
  };
  describe('permissions', () => {
    it('researcher that is not study admin should not have access to permissions', () => {
      const studyThatResearcherIsNotStudyAdmin = studies.organizations.find(study => {
        return study.researcherIsAdmin === false;
      }).name;
      getOrgStudyPermissions(studyThatResearcherIsNotStudyAdmin);
      cy.get("div[data-testid='unable-to-access-permission']");
    });
    it('researcher that is study admin should have access to permissions', () => {
      const studyThatResearcherIsStudyAdmin = studies.organizations.find(study => {
        return study.researcherIsAdmin;
      }).name;
      getOrgStudyPermissions(studyThatResearcherIsStudyAdmin);
      cy.get("table[data-testid='edit-permission-table']");
    });
  });
});
