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
