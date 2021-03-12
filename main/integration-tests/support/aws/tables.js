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

const _ = require('lodash');

const Table = require('./utils/table');

// Returns the normalized table names with the prefix
async function getTableNames() {
  // Future: allow components to contribute table names via an extension point
  return [
    'accounts',
    'authenticationProviderConfigs',
    'authenticationProviderTypes',
    'awsAccounts',
    'costApiCaches',
    'deploymentStore',
    'environments',
    'environmentsSc',
    'environmentTypes',
    'indexes',
    'keyPairs',
    'locks',
    'passwords',
    'projects',
    'revokedTokens',
    'stepTemplates',
    'storageGateway',
    'studies',
    'studyPermissions',
    'userApiKeys',
    'userRoles',
    'users',
    'wfAssignments',
    'workflowDrafts',
    'workflowInstances',
    'workflows',
    'workflowTemplateDrafts',
    'workflowTemplates',
    'dsAccounts',
    'roleAllocations',
  ];
}

// Returns table helper instances based on the table names
async function getTables({ dynamoDb }) {
  const tableNames = await getTableNames({ dynamoDb });
  const tables = {};

  _.forEach(tableNames, name => {
    tables[name] = new Table({ dynamoDb, name });
  });

  return tables;
}

module.exports = { getTables, getTableNames };
