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
describe('projects', () => {
  const NUMBER_OF_COLUMNS = 5;

  const navigateToAccounts = () => {
    cy.get('.left.menu')
      .contains('Accounts')
      .click();
  };

  const verifyProjectDetails = () => {
    let project = {};
    cy.get("div[data-testid='projects-table']")
      .find('.rt-td')
      .each(($el, $index) => {
        cy.wrap($el)
          .invoke('text')
          .then(text => {
            if ($index % NUMBER_OF_COLUMNS == 0) {
              project['id'] = text;
            } else if ($index % NUMBER_OF_COLUMNS == 1) {
              project['index'] = text;
            } else if ($index % NUMBER_OF_COLUMNS == 2) {
              project['description'] = text;
            } else if ($index % NUMBER_OF_COLUMNS == 4) {
              cy.get(`Button[data-testid='${project.id}-detail-button']`).click();
              cy.get('tbody')
                .find('td')
                .each(($el, $index) => {
                  cy.wrap($el)
                    .invoke('text')
                    .then(text => {
                      if ($index == 1) {
                        // Index 1 belongs to Project Name
                        if (project.id != text) {
                          throw new Error(`Expected Project Name ${project.id}; found ${text}`);
                        }
                      } else if ($index == 3) {
                        // Index 3 belongs to Description
                        if (project.description != text) {
                          throw new Error(`Expected Description ${project.description}; found ${text}`);
                        }
                      }
                    });
                });
              cy.get(`Button[data-testid='Cancel']`).click();
            }
          });
      });
    return true;
  };

  const clickOnProjectNameColHeader = () => {
    cy.get("div[data-testid='projects-table']")
      .contains('Project Name')
      .click();
  };

  it('should allow admin to see and sort projects', () => {
    cy.login('admin');
    navigateToAccounts();

    verifyProjectDetails();

    clickOnProjectNameColHeader();

    verifyProjectDetails();
  });
});
