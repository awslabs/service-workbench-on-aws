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
const Service = require('@aws-ee/base-services-container/lib/service');

const {
  isDeny,
  allowIfActive,
  allowIfAdmin,
  allowIfRoot,
  allowIfSystem,
  allowIfCurrentUserOrAdmin,
  allow,
  deny,
} = require('../authorization/authorization-utils');

class UserAuthzService extends Service {
  async authorize(requestContext, { resource, action, effect, reason }, ...args) {
    // if effect is "deny" already (due to any of the previous plugins returning "deny") then return "deny" right away
    if (isDeny({ effect })) return { resource, action, effect, reason };

    switch (action) {
      case 'create':
        return this.authorizeCreate(requestContext, { action }, ...args);
      case 'delete':
        return this.authorizeDelete(requestContext, { action }, ...args);
      case 'update':
        return this.authorizeUpdate(requestContext, { action }, ...args);
      case 'updateAttributes':
        return this.authorizeUpdateAttributes(requestContext, { action }, ...args);
      default:
        // This authorizer does not know how to perform authorizer for the specified action so return with the current
        // authorization decision collected so far
        return { effect };
    }
  }

  // Protected methods
  async authorizeCreate(requestContext, { action }, user) {
    // Make sure the caller is active
    let permissionSoFar = await allowIfActive(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // Only admins can create users by default
    permissionSoFar = await allowIfAdmin(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // Only system can create root user
    if (_.get(user, 'userType') === 'root') {
      permissionSoFar = await allowIfSystem(requestContext, { action });
      if (isDeny(permissionSoFar)) return permissionSoFar;
    }

    // If code reached here then allow this call
    return allow();
  }

  async authorizeDelete(requestContext, { action }, user) {
    // basic authorization rules for delete user are same as create user at the moment
    const result = await this.authorizeCreate(requestContext, { action });

    // return right away if denying
    if (isDeny(result)) return result; // return if denying

    // Make sure root user can be deleted only by root user her/himself
    if (_.get(user, 'userType') === 'root') {
      const permissionSoFar = await allowIfRoot(requestContext, { action });
      if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying
    }

    // If code reached here then allow this call
    return allow();
  }

  async authorizeUpdate(requestContext, { action }, user) {
    // Make sure the caller is active
    let permissionSoFar = await allowIfActive(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // User can update only their own attributes unless the user is an admin
    const { uid } = user;
    permissionSoFar = await allowIfCurrentUserOrAdmin(requestContext, { action }, { uid });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    return allow();
  }

  async authorizeUpdateAttributes(requestContext, { action }, user, existingUser) {
    let permissionSoFar = allow();
    // Inspect the attributes being updated and make sure the user has permissions to update those attributes
    if (existingUser.isAdmin !== user.isAdmin || existingUser.status !== user.status) {
      // The "isAdmin" and "status" properties should be updated only by admins
      permissionSoFar = await allowIfAdmin(requestContext, { action });
      if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying
    }

    if (existingUser.userType === 'root') {
      // If the existing user is root user then make sure only root user is updating it
      permissionSoFar = await allowIfRoot(requestContext, { action });
      if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

      // Certain properties on root user are immutable so should not be updated
      if (
        existingUser.authenticationProviderId !== user.authenticationProviderId ||
        existingUser.identityProviderName !== user.identityProviderName ||
        existingUser.isAdmin !== user.isAdmin
      ) {
        return deny('You are not authorized to update these fields on the root user', true);
      }
    }
    return allow();
  }
}
module.exports = UserAuthzService;
