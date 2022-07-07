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
// eslint-disable-next-line import/no-extraneous-dependencies
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

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
  const authenticationData = {
    Username: loginInfo.email,
    Password: loginInfo.password,
  };

  const authenticationDetails = new AuthenticationDetails(authenticationData);
  const poolData = {
    UserPoolId: Cypress.env('cognitoUserPoolId'),
    ClientId: Cypress.env('cognitoClientId'),
  };
  const userPool = new CognitoUserPool(poolData);
  const userData = {
    Username: loginInfo.email,
    Pool: userPool,
  };

  const cognitoUser = new CognitoUser(userData);

  const authResult = new Cypress.Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess(result) {
        const accessToken = result.getIdToken().getJwtToken();
        window.localStorage.setItem('appIdToken', accessToken);
        resolve('Successfully authenticated user');
      },

      onFailure(err) {
        Cypress.log({ message: `Failed to authenticate user ${JSON.stringify(err)}` });
        reject('Failed to authenticate user');
      },
    });
  });
  cy.wrap(authResult);
  cy.visit('/dashboard', {
    onBeforeLoad(window) {
      // Allows us to check for window open event
      cy.stub(window, 'open');
    },
  });
  cy.get("div[data-testid='page-title'] div").contains('Dashboard');
});
