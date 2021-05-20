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
