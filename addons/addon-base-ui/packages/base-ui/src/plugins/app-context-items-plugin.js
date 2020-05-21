import * as appRunner from '../models/AppRunner';
import * as appStore from '../models/App';
import * as cleaner from '../models/Cleaner';
import * as sessionStore from '../models/SessionStore';
import * as showdown from '../models/Showdown';
import * as userApiKeysStore from '../models/api-keys/UserApiKeysStore';
import * as authentication from '../models/authentication/Authentication';
import * as authenticationProviderConfigsStore from '../models/authentication/AuthenticationProviderConfigsStore';
import * as authenticationProviderPublicConfigsStore from '../models/authentication/AuthenticationProviderPublicConfigsStore';
import * as userDisplayName from '../models/users/UserDisplayName';
import * as usersStore from '../models/users/UsersStore';
import * as userStore from '../models/users/UserStore';
import loginImage from '../../images/login-image.gif';

/**
 * Registers base stores to the appContext object
 *
 * @param appContext An application context object
 */
// eslint-disable-next-line no-unused-vars
function registerAppContextItems(appContext) {
  appRunner.registerContextItems(appContext);
  appStore.registerContextItems(appContext);
  cleaner.registerContextItems(appContext);
  sessionStore.registerContextItems(appContext);
  showdown.registerContextItems(appContext);
  userApiKeysStore.registerContextItems(appContext);
  authentication.registerContextItems(appContext);
  authenticationProviderConfigsStore.registerContextItems(appContext);
  authenticationProviderPublicConfigsStore.registerContextItems(appContext);
  userDisplayName.registerContextItems(appContext);
  usersStore.registerContextItems(appContext);
  userStore.registerContextItems(appContext);
  appContext.assets.images.loginImage = loginImage;
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
