import UserApplication from '../parts/UserApplication';

// eslint-disable-next-line consistent-return, no-unused-vars
function getAppComponent({ location, appContext }) {
  const app = appContext.app || {};
  // We are only going to return an App react component if the user is authenticated
  // and not registered, otherwise we return undefined which means that the base ui
  // plugin will provide its default App react component.
  if (app.userAuthenticated && !app.userRegistered) {
    return UserApplication;
  }
}

const plugin = {
  getAppComponent,
};

export default plugin;
