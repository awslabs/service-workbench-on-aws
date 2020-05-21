const RequestContext = require('@aws-ee/base-services-container/lib/request-context');

const internalAuthProviderId = 'internal'; // TODO - make this string comes from constants

/**
 * A helper function that helps create requestContext for system users.
 * Most of the services accept "requestContext" argument which provides context about the service call (such as who is the caller of the service i.e., the "principal" etc)
 * In case of system calls (i.e., calls not initiated by any "principal" but result of some system operation such as execution of post-deployment steps),
 * the requestContext should contain information about the implicit "system" user.
 * This method returns this "requestContext" that can be passed to services for system calls.
 *
 * @returns {Service}
 */
function getSystemRequestContext() {
  const ctx = new RequestContext();

  const systemUsername = '_system_';
  const systemUserNamespace = internalAuthProviderId;

  ctx.authenticated = true;
  ctx.principal = {
    username: systemUsername,
    ns: systemUserNamespace,
    isAdmin: true,
    status: 'active',
  };
  ctx.principalIdentifier = {
    username: systemUsername,
    ns: systemUserNamespace,
  };

  return ctx;
}

module.exports = {
  getSystemRequestContext,
};
