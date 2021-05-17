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

const Authentication = require('./resources/authentication/authentication');
const Users = require('./resources/users/users');
const Ip = require('./resources/ip/ip');
const Costs = require('./resources/costs/costs');
const Templates = require('./resources/templates/templates');
const UserRoles = require('./resources/user-roles/user-roles');
const Studies = require('./resources/studies/studies');
const Projects = require('./resources/projects/projects');
const Indexes = require('./resources/indexes/indexes');
const CurrentUser = require('./resources/current-user');
const PublicAuthProviderConfigs = require('./resources/public-auth-provider/public-auth-provider-configs');
const WorkspaceTypes = require('./resources/workspace-types/workspace-types');
const AwsAccounts = require('./resources/aws-accounts/aws-accounts');
const Accounts = require('./resources/accounts/accounts');
const WorkspaceTypeCandidates = require('./resources/workspace-type-candidates/workspace-type-candidates');
const StepTemplates = require('./resources/step-templates/step-templates');
const KeyPairs = require('./resources/key-pairs/key-pairs');
const WorkflowTemplates = require('./resources/workflow-templates/workflow-templates');
const DataSourceAccounts = require('./resources/data-sources/accounts');
const Budgets = require('./resources/budgets/budgets');
const WorkspaceServiceCatalogs = require('./resources/workspace-service-catalogs/workspace-service-catalogs');
const Workflows = require('./resources/workflows/workflows');

// Returns the top level resource operations helpers. You should not use this directly in your tests.
// These top level resource operation helpers are available via client sessions.
async function getResources({ clientSession }) {
  const resources = {
    authentication: new Authentication({ clientSession }),
    users: new Users({ clientSession }),
    ip: new Ip({ clientSession }),
    costs: new Costs({ clientSession }),
    templates: new Templates({ clientSession }),
    userRoles: new UserRoles({ clientSession }),
    studies: new Studies({ clientSession }),
    projects: new Projects({ clientSession }),
    indexes: new Indexes({ clientSession }),
    accounts: new Accounts({ clientSession }),
    awsAccounts: new AwsAccounts({ clientSession }),
    currentUser: new CurrentUser({ clientSession }),
    publicAuthProviderConfigs: new PublicAuthProviderConfigs({ clientSession }),
    workspaceTypes: new WorkspaceTypes({ clientSession }),
    workspaceTypeCandidates: new WorkspaceTypeCandidates({ clientSession }),
    stepTemplates: new StepTemplates({ clientSession }),
    keyPairs: new KeyPairs({ clientSession }),
    workflowTemplates: new WorkflowTemplates({ clientSession }),
    dataSources: { accounts: new DataSourceAccounts({ clientSession }) },
    budgets: new Budgets({ clientSession }),
    workspaceServiceCatalogs: new WorkspaceServiceCatalogs({ clientSession }),
    workflows: new Workflows({ clientSession }),
  };

  return resources;
}

module.exports = getResources;
