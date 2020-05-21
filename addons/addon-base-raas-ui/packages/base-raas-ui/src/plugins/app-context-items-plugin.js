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
