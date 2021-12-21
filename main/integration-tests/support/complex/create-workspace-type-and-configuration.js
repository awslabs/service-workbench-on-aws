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
const { addProductInfo } = require('./default-integration-test-product');

/**
 * A function that performs the complex task of creating a workspace type
 * and configuration.
 */
async function createWorkspaceTypeAndConfiguration(productInfo, adminSession, setup, allowRoleIds = ['admin']) {
  const workspaceTypeId = setup.gen.string({ prefix: 'workspace-test' });
  const configurationId = setup.gen.string({ prefix: 'configuration-test' });

  await adminSession.resources.workspaceTypes.create(
    addProductInfo({ id: workspaceTypeId, status: 'approved' }, productInfo),
  );
  await adminSession.resources.workspaceTypes
    .workspaceType(workspaceTypeId)
    .configurations()
    .create({ id: configurationId, allowRoleIds });

  return { workspaceTypeId, configurationId };
}

module.exports = { createWorkspaceTypeAndConfiguration };
