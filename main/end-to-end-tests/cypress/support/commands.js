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

// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

// TODO: Look into using requests for logging in, instead of using the UI
// https://docs.cypress.io/api/commands/request.html#HTML-form-submissions-using-form-option

// TODO: If an environment is configured with an Identity Provider, the login steps needs to select an
// identity provider
Cypress.Commands.add('login', role => {
  let loginInfo = {};
  if (role === 'researcher') {
    loginInfo = {
      email: Cypress.env('researcherEmail'),
      password: Cypress.env('researcherPassword'),
    };
  }
  if (role === 'restrictedResearcher') {
    loginInfo = {
      email: Cypress.env('restrictedResearcherEmail'),
      password: Cypress.env('restrictedResearcherPassword'),
    };
  } else if (role === 'admin') {
    loginInfo = {
      email: Cypress.env('adminEmail'),
      password: Cypress.env('adminPassword'),
    };
  }
  const isCognitoEnabled = Cypress.env('isCognitoEnabled');

  if (isCognitoEnabled) {
    cy.visit('/?internal', {
      // Allows us to check for window open event
      onBeforeLoad(window) {
        cy.stub(window, 'open');
      },
    });
  } else {
    cy.visit('/', {
      onBeforeLoad(window) {
        // Allows us to check for window open event
        cy.stub(window, 'open');
      },
    });
  }
  cy.get("div[data-testid='username'] input").type(loginInfo.email);
  cy.get("div[data-testid='password'] input").type(loginInfo.password);
  cy.get("button[data-testid='login']").click();
  cy.get("div[data-testid='page-title'] div").contains('Dashboard');
});
