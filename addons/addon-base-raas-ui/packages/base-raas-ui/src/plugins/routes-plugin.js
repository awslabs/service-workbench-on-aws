import _ from 'lodash';
import withAuth from '@aws-ee/base-ui/dist/withAuth';

import User from '../parts/users/User';
import Accounts from '../parts/accounts/Accounts';
import AddUser from '../parts/users/AddUser';
import AddIndex from '../parts/accounts/AddIndex';
import Dashboard from '../parts/dashboard/Dashboard';
import StudiesPage from '../parts/studies/StudiesPage';
import StudyEnvironmentSetup from '../parts/studies/StudyEnvironmentSetup';
import EnvironmentsList from '../parts/environments/EnvironmentsList';
import EnvironmentDetailPage from '../parts/environments/EnvironmentDetailPage';
import AddAwsAccount from '../parts/accounts/AddAwsAccount';
import CreateAwsAccount from '../parts/accounts/CreateAwsAccount';
import EnvironmentSetup from '../parts/environments/EnvironmentSetup';
import AddProject from '../parts/projects/AddProject';

/**
 * Adds routes to the given routesMap.
 * @param routesMap A Map containing routes. This object is a Map that has route paths as
 * keys and React Component as value.
 *
 * @returns {Promise<*>} Returns a Map with the mapping of base routes vs React Component
 */
// eslint-disable-next-line no-unused-vars
function registerRoutes(routesMap, { location, appContext }) {
  const routes = new Map([
    ...routesMap,
    ['/users/add', withAuth(AddUser)],
    ['/indexes/add', withAuth(AddIndex)],
    ['/aws-accounts/add', withAuth(AddAwsAccount)],
    ['/aws-accounts/create', withAuth(CreateAwsAccount)],
    ['/users', withAuth(User)],
    ['/accounts', withAuth(Accounts)],
    ['/dashboard', withAuth(Dashboard)],
    ['/studies/setup-workspace', withAuth(StudyEnvironmentSetup)],
    ['/studies', withAuth(StudiesPage)],
    ['/workspaces/create', withAuth(EnvironmentSetup)],
    ['/workspaces/id/:instanceId', withAuth(EnvironmentDetailPage)],
    ['/workspaces', withAuth(EnvironmentsList)],
    ['/projects/add', withAuth(AddProject)],
  ]);

  return routes;
}

function getDefaultRouteLocation({ location, appContext }) {
  const userStore = appContext.userStore;
  let defaultRoute = '/dashboard';
  const isRootUser = _.get(userStore, 'user.isRootUser');
  const isExternalResearcher = _.get(userStore, 'user.isExternalResearcher');
  const isInternalGuest = _.get(userStore, 'user.isInternalGuest');
  const isExternalGuest = _.get(userStore, 'user.isExternalGuest');

  if (isRootUser) {
    defaultRoute = '/users';
  } else if (isExternalResearcher) {
    defaultRoute = '/workspaces';
  } else if (isInternalGuest || isExternalGuest) {
    defaultRoute = '/studies';
  }

  // See https://reacttraining.com/react-router/web/api/withRouter
  const defaultLocation = {
    pathname: defaultRoute,
    search: location.search, // we want to keep any query parameters
    hash: location.hash,
    state: location.state,
  };

  return defaultLocation;
}

const plugin = {
  registerRoutes,
  getDefaultRouteLocation,
};

export default plugin;
