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

const Users = require('./resources/users/users.js');
const Studies = require('./resources/studies/studies.js');
const Projects = require('./resources/projects/projects.js');
const Indexes = require('./resources/indexes/indexes.js');
const CurrentUser = require('./resources/current-user.js');
const PublicAuthProviderConfigs = require('./resources/public-auth-provider/public-auth-provider-configs');
const WorkspaceTypes = require('./resources/workspace-types/workspace-types.js');

// Returns the top level resource operations helpers. You should not use this directly in your tests.
// These top level resource operation helpers are available via client sessions.
async function getResources({ clientSession }) {
  const resources = {
    users: new Users({ clientSession }),
    studies: new Studies({ clientSession }),
    projects: new Projects({ clientSession }),
    indexes: new Indexes({ clientSession }),
    currentUser: new CurrentUser({ clientSession }),
    publicAuthProviderConfigs: new PublicAuthProviderConfigs({ clientSession }),
    workspaceTypes: new WorkspaceTypes({ clientSession }),
  };

  return resources;
}

module.exports = getResources;
