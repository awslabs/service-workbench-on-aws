import App from '../App';
import AutoLogout from '../parts/AutoLogout';

// eslint-disable-next-line no-unused-vars
function getAppComponent({ location, appContext }) {
  return App;
}

// eslint-disable-next-line no-unused-vars
function getAutoLogoutComponent({ location, appContext }) {
  return AutoLogout;
}

const plugin = {
  getAppComponent,
  getAutoLogoutComponent,
};

export default plugin;
