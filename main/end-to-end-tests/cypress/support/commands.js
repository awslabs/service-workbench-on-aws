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
// eslint-disable-next-line import/no-extraneous-dependencies

Cypress.Commands.add('login', () => {
  const loginInfo = {
    researcherEmail: Cypress.env('researcherEmail'),
    researcherPassword: Cypress.env('researcherPassword'),
  };

  cy.visit('/');
  cy.get("div[data-testid='username'] input").type(loginInfo.researcherEmail);
  cy.get("div[data-testid='password'] input").type(loginInfo.researcherPassword);
  cy.get("button[data-testid='login']").click();
  cy.get("div[data-testid='page-title'] div").contains('Dashboard');
});
