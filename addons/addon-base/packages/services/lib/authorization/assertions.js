const _ = require('lodash');
const Boom = require('@aws-ee/base-services-container/lib/boom');

const boom = new Boom();
const internalAuthProviderId = 'internal';

const isCurrentUser = (requestContext, username, ns) =>
  requestContext.principalIdentifier.username === username && requestContext.principalIdentifier.ns === ns;

async function ensureCurrentUserOrAdmin(requestContext, username, ns = internalAuthProviderId) {
  const isCurrentUserOrAdmin = isCurrentUser(requestContext, username, ns) || requestContext.principal.isAdmin;
  if (!isCurrentUserOrAdmin) {
    throw boom.forbidden('You are not authorized to perform this operation', true);
  }
}

async function ensureCurrentUser(requestContext, username, ns) {
  const identifer = requestContext.principalIdentifier;

  if (identifer.username !== username || identifer.ns !== ns) {
    throw boom.forbidden('You are not authorized to perform this operation on another user', true);
  }
}

async function ensureAdmin(requestContext) {
  const isAdmin = _.get(requestContext, 'principal.isAdmin', false);
  if (!isAdmin) {
    throw boom.forbidden('You are not authorized to perform this operation', true);
  }
}

async function ensureRoot(requestContext) {
  const isRoot = _.get(requestContext, 'principal.userType') === 'root';
  if (!isRoot) {
    throw boom.forbidden('You are not authorized to perform this operation', true);
  }
}

module.exports = {
  ensureCurrentUserOrAdmin,
  ensureAdmin,
  isCurrentUser,
  ensureCurrentUser,
  ensureRoot,
};
