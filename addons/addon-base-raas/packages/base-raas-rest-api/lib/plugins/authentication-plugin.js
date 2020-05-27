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

const _ = require('lodash');
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

/**
 * The main authentication plugin function. This plugin implementation adds customization by
 * checking for user's role. The authentication plugins are used by the "authentication-service.js".
 *
 * @param authenticationPluginPayload A plugin's payload. This has the shape { token, container, authResult }.
 * @param authenticationPluginPayload.token The JWT token being used for authentication.
 * @param authenticationPluginPayload.container Services container that provides service implementations for registered services
 * @param authenticationPluginPayload.authResult The current authentication result containing authentication decision evaluated so far
 * (by previous plugins or the original decision from the authenticationService).
 *
 * @returns {Promise<{container: *, authResult: {authenticated: boolean}, token: *}|*>}
 */
async function authenticate(authenticationPluginPayload) {
  const { token, container, authResult } = authenticationPluginPayload;
  const notAuthenticated = (claims) => ({ token, container, authResult: { ...claims, authenticated: false } });
  const isAuthenticated = _.get(authResult, 'authenticated', false);

  // if the current authentication decision is "not authenticated" then return right away
  if (!isAuthenticated) return authenticationPluginPayload;

  const logger = await container.find('log');
  try {
    const { username, authenticationProviderId, identityProviderName } = authResult;
    const userService = await container.find('userService');
    const user = await userService.mustFindUser({
      username,
      authenticationProviderId,
      identityProviderName,
    });
    const userRoleId = _.get(user, 'userRole');
    if (!userRoleId) {
      // no user role, don't know what kind of user is this, return not authenticated
      return notAuthenticated(...authResult);
    }

    const userRolesService = await container.find('userRolesService');
    // Make sure the user's role exists
    // It is possible that the user was created before with some role and then that role was disabled
    // For example, if a user with an "external-researcher" role was created before but then the external-researcher role was
    // disabled (by setting the enableExternalResearchers = false) in that case the "external-researcher" may no longer
    // be a valid role but there may still be some existing users with that role. Those users should no longer be able
    // to login.
    await userRolesService.mustFind(getSystemRequestContext(), { id: userRoleId });
  } catch (e) {
    logger.error('Error authenticating the user');
    logger.error(e);
    return notAuthenticated(...authResult);
  }
  return authenticationPluginPayload;
}

const plugin = {
  authenticate,
};

module.exports = plugin;
