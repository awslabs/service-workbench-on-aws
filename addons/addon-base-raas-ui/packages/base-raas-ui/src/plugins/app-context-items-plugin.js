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

import * as app from '../models/App';
import * as userStore from '../models/users/UserStore';
import * as usersStore from '../models/users/UsersStore';
import * as accountsStore from '../models/accounts/AccountsStore';
import * as awsAccountsStore from '../models/aws-accounts/AwsAccountsStore';
import * as clientInformationStore from '../models/client-info/ClientInformationStore';
import * as environment from '../models/environments/Environment';
import * as environmentConfigurationsStore from '../models/environments/EnvironmentConfigurationsStore';
import * as environmentsStore from '../models/environments/EnvironmentsStore';
import * as fileUploadsStore from '../models/files/FileUploadsStore';
import * as indexesStore from '../models/indexes/IndexesStore';
import * as projectsStore from '../models/projects/ProjectsStore';
import * as filesSelection from '../models/selections/FilesSelection';
import * as studiesStore from '../models/studies/StudiesStore';
import * as userRolesStore from '../models/user-roles/UserRolesStore';
import * as computePlatformsStore from '../models/compute/ComputePlatformsStore';
import * as scEnvironmentsStore from '../models/environments-sc/ScEnvironmentsStore';
import * as scEnvironmentCostsStore from '../models/environments-sc/ScEnvironmentCostsStore';
import * as dataSourceAccountsStore from '../models/data-sources/DataSourceAccountsStore';
import * as registerStudyWizard from '../models/data-sources/register/RegisterStudyWizard';
import { enableBuiltInWorkspaces } from '../helpers/settings';

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
  scEnvironmentsStore.registerContextItems(appContext);
  scEnvironmentCostsStore.registerContextItems(appContext);
  dataSourceAccountsStore.registerContextItems(appContext);
  registerStudyWizard.registerContextItems(appContext);

  // console.log('enableBuiltInWorkspaces', enableBuiltInWorkspaces);
  // If built in workspaces are enabled then do not show environment type management
  // using AWS Service Catalog
  appContext.showEnvTypeManagement = !enableBuiltInWorkspaces;
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
