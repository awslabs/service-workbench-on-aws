/* eslint-disable no-template-curly-in-string */
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

describe('Check that variables prepopulate when making a new configuration', () => {
  before(() => {
    cy.login('admin');
    navigateToWorkspaceTypes();
  });

  const navigateToWorkspaceTypes = () => {
    cy.get('.left.menu')
      .contains('Types')
      .click();
  };

  it('should have the proper variables prepopulated-EMR', () => {
    const isAppStreamEnabled = Cypress.env('isAppStreamEnabled');
    // AppStream enabled env does not support EMR (10/7/21)
    if (!isAppStreamEnabled) {
      const workspaces = Cypress.env('workspaces');
      const emr = workspaces.emr;
      checkPrepopVariables(emr, 'EMR');
    }
  });

  it('should have the proper variables prepopulated-EC2 Linux', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2 = workspaces.ec2.linux;
    checkPrepopVariables(ec2, 'EC2 Linux');
  });

  it('should have the proper variables prepopulated-Sagemaker', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2 = workspaces.sagemaker;
    checkPrepopVariables(ec2, 'Sagemaker');
  });

  it('should have the proper variables prepopulated-EC2 Windows', () => {
    const workspaces = Cypress.env('workspaces');
    const ec2windows = workspaces.ec2.windows;
    checkPrepopVariables(ec2windows, 'EC2 Windows');
  });

  const checkPrepopVariables = (workspaceParam, workspaceType) => {
    const isAppStreamEnabled = Cypress.env('isAppStreamEnabled');
    navigateToWorkspaceTypes();
    // Get env type card and click edit for the right card
    cy.get('[data-testid=env-type-card]')
      .contains(workspaceParam.workspaceTypeName)
      .parent()
      .parent()
      .get(`button[data-testid="editbutton-${workspaceParam.workspaceTypeName}"]`)
      .click();

    // switch to Configurations tab
    cy.contains('Configurations').click();

    // Add new configuration
    cy.get('[data-testid=add-config-button]')
      .contains('Add Configuration')
      .click();

    // Input dummy values in necessary fields
    cy.get('[data-testid=config-id-input]').type('test');
    cy.get('[data-testid=config-name-input]').type('test');
    cy.get('[data-testid=config-desc-input]').type('test');

    // Click Next
    cy.get('button')
      .contains('Next')
      .click();

    // Select admin from dropdown (could be any valid value--just can't be blank)
    cy.get('[data-testid=allow-dropdown]')
      .click()
      .find('.item')
      .contains('admin')
      .click();

    // Click Next
    cy.get('button')
      .contains('Next')
      .click();

    // Make sure the correct variables have the correct default values for the current workspace type
    if (workspaceType === 'EMR' || workspaceType === 'EC2 Windows') {
      cy.get('[data-testid=KeyName]').contains('${adminKeyPairName}');
    }
    cy.get('[data-testid=EncryptionKeyArn]').contains('${encryptionKeyArn}');
    cy.get('[data-testid=VPC]').contains('${vpcId}');
    // AppStream enabled env does not support CIDR
    if (!isAppStreamEnabled) {
      cy.get('[data-testid=AccessFromCIDRBlock]').contains('${cidr}');
    }
    cy.get('[data-testid=S3Mounts]').contains('${s3Mounts}');
    cy.get('[data-testid=Namespace]').contains('${namespace}');
    cy.get('[data-testid=IamPolicyDocument]').contains('${iamPolicyDocument}');
    cy.get('[data-testid=EnvironmentInstanceFiles]').contains('${environmentInstanceFiles}');
    cy.get('[data-testid=Subnet]').contains('${subnetId}');

    // Back out of the configuration so no resources are made so this test is repeatable
    cy.get('button[data-testid=cancel-button]')
      .contains('Cancel')
      .click();
    cy.get('button[data-testid=cancel-button]')
      .contains('Cancel')
      .click();
  };
});
