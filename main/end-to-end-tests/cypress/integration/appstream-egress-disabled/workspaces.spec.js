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
import { terminatePreExistingWorkspaces, launchWorkspace, navigateToWorkspaces } from '../../support/workspace-util';

describe('Launch new workspaces', () => {
  before(() => {
    cy.login('researcher');
    navigateToWorkspaces();
    terminatePreExistingWorkspaces();
  });

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
});
