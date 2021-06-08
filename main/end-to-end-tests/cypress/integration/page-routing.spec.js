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
describe('page routing', () => {
  describe('should navigate to /users page correctly', () => {
    it('should redirect researchers trying to access /users page', () => {
      cy.login('researcher');
      cy.visit('/users');
      cy.get("div[data-testid='page-title'] div").contains('Dashboard');
    });
    it('should allow admin to access /users page', () => {
      cy.login('admin');
      cy.visit('/users');
      cy.get("div[data-testid='users-table']");
    });
  });
});
