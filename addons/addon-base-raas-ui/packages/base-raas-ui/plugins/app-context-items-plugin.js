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

import * as app from '../src/models/App';
import * as userStore from '../src/models/users/UserStore';
import * as usersStore from '../src/models/users/UsersStore';
import * as accountsStore from '../src/models/accounts/AccountsStore';
import * as awsAccountsStore from '../src/models/aws-accounts/AwsAccountsStore';
import * as clientInformationStore from '../src/models/client-info/ClientInformationStore';
import * as environment from '../src/models/environments/Environment';
import * as environmentConfigurationsStore from '../src/models/environments/EnvironmentConfigurationsStore';
import * as environmentsStore from '../src/models/environments/EnvironmentsStore';
import * as fileUploadsStore from '../src/models/files/FileUploadsStore';
import * as indexesStore from '../src/models/indexes/IndexesStore';
import * as projectsStore from '../src/models/projects/ProjectsStore';
import * as filesSelection from '../src/models/selections/FilesSelection';
import * as studiesStore from '../src/models/studies/StudiesStore';
import * as userRolesStore from '../src/models/user-roles/UserRolesStore';
import * as computePlatformsStore from '../src/models/compute/ComputePlatformsStore';

// eslint-disable-next-line no-unused-vars
function registerAppContextItems(appContext) {
  app.registerContextItems(appContext);
  userStore.registerContextItems(appContext);
  usersStore.registerContextItems(appContext);
  accountsStore.registerContextItems(appContext);
  awsAccountsStore.registerContextItems(appContext);
  clientInformationStore.registerContextItems(appContext);
  environment.registerContextItems(appContext);
  environmentConfigurationsStore.registerContextItems(appContext);
  environmentsStore.registerContextItems(appContext);
  fileUploadsStore.registerContextItems(appContext);
  indexesStore.registerContextItems(appContext);
  projectsStore.registerContextItems(appContext);
  filesSelection.registerContextItems(appContext);
  studiesStore.registerContextItems(appContext);
  userRolesStore.registerContextItems(appContext);
  computePlatformsStore.registerContextItems(appContext);
}

// eslint-disable-next-line no-unused-vars
function postRegisterAppContextItems(appContext) {
  // No impl at this level
}

const plugin = {
  registerAppContextItems,
  postRegisterAppContextItems,
};

export default plugin;
