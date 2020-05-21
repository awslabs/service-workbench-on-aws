const _ = require('lodash');
const { allow, deny } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

function allowIfHasRole(requestContext, { action, resource }, allowedUserRoles) {
  const userRole = _.get(requestContext, 'principal.userRole');
  if (!_.includes(allowedUserRoles, userRole)) {
    const resourceDisplayName = resource || 'resource';
    return deny(
      `Cannot ${action} ${resourceDisplayName}. The user's role "${userRole}" is not allowed to ${action} ${resourceDisplayName}`,
      false,
    );
  }
  return allow();
}

module.exports = {
  allowIfHasRole,
};
