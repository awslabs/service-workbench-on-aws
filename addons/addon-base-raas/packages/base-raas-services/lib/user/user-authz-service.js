const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

const {
  isDeny,
  allowIfActive,
  allowIfAdmin,
  allowIfCurrentUserOrAdmin,
  allowIfRoot,
  allow,
  deny,
} = require('@aws-ee/base-services/lib/authorization/authorization-utils');
const { toUserNamespace } = require('@aws-ee/base-services/lib/user/helpers/user-namespace');

class UserAuthzService extends Service {
  async authorize(requestContext, { resource, action, effect, reason }, ...args) {
    const permissionSoFar = { resource, action, effect, reason };

    // in base-raas-services authorization logic needs to be customized only for "createBulk", "update", and
    // "updateAttributes" action, for all other actions let it return permissions evaluated by base authorization plugin
    // See "raas/addons/addon-base/packages/services/lib/plugins/authorization-plugin.js" for base authorization plugin implementation and
    // See "raas/addons/addon-base/packages/services/lib/user/user-authorization-service.js" that implements base authorization logic for "user" resource
    switch (action) {
      case 'createBulk':
        // if effect is "deny" already (due to any of the previous plugins returning "deny") then return "deny" right away
        if (isDeny({ effect })) return permissionSoFar;
        return this.authorizeCreateBulk(requestContext, { action, effect }, ...args);
      case 'update':
        // For "update", DO NOT return "deny" if other plugins returned deny, instead use our own authorization logic.
        // This is because, the base authorization impl denies "update" by non-active users but we need to allow
        // self-update in "pending" status to support self-enrollment application feature
        return this.authorizeUpdate(requestContext, { action, effect }, ...args);
      case 'updateAttributes':
        // Just like the "update" case, DO NOT return "deny" if other plugins returned deny, instead use our own authorization logic.
        return this.authorizeUpdateAttributes(requestContext, { resource, action, effect, reason }, ...args);
      default:
        return permissionSoFar;
    }
  }

  async authorizeUpdate(requestContext, { action, effect }, user) {
    // Allow update to "pending" status even if the caller is inactive to support self-enrollment application
    let permissionSoFar = { action, effect };
    if (user.status !== 'pending') {
      // When updating user's status to anything other than "pending" make sure the caller is active
      // Make sure the caller is active
      permissionSoFar = await allowIfActive(requestContext, { action });
      if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying
    }

    // User can update only their own attributes unless the user is an admin
    const { username, authenticationProviderId, identityProviderName } = user;
    const ns = toUserNamespace(authenticationProviderId, identityProviderName);
    permissionSoFar = await allowIfCurrentUserOrAdmin(requestContext, { action }, { username, ns });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    return allow();
  }

  async authorizeCreateBulk(requestContext, { action }) {
    // Make sure the caller is active
    let permissionSoFar = await allowIfActive(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // Only admins can create users in bulk by default
    permissionSoFar = await allowIfAdmin(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // If code reached here then allow this call
    return allow();
  }

  async authorizeUpdateAttributes(requestContext, { action }, user, existingUser) {
    const isBeingUpdated = attribName => {
      const oldValue = _.get(existingUser, attribName);
      const newValue = _.get(user, attribName);
      // The update ignores undefined values during update (i.e., it retains existing values for those)
      // so compare for only if the new value is undefined
      return !_.isUndefined(newValue) && oldValue !== newValue;
    };

    let permissionSoFar;
    // In addition to the permissions ascertained by the base class,
    // make sure that we allow updating "userRole" only by admins
    if (isBeingUpdated('isExternalUser') || isBeingUpdated('userRole')) {
      // The "isExternalUser" and "userRole" properties should be updated only by admins
      permissionSoFar = await allowIfAdmin(requestContext, { action });
      if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying
    }

    // Similarly, in addition to the permissions ascertained by the base,
    // make sure the following properties on root are immutable
    if (existingUser.userType === 'root') {
      permissionSoFar = await allowIfRoot(requestContext, { action });
      if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

      if (
        isBeingUpdated('authenticationProviderId') ||
        isBeingUpdated('identityProviderName') ||
        isBeingUpdated('isAdmin') ||
        isBeingUpdated('userRole') ||
        isBeingUpdated('projectId')
      ) {
        return deny('You are not authorized to alter these fields on the root user', true);
      }
    }

    // If code reached here then allow this call
    return allow();
  }
}

module.exports = UserAuthzService;
