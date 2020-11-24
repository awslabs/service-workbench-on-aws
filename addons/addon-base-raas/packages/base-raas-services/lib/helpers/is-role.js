const _ = require('lodash');

function isRole(requestContext, roleName) {
  return _.get(requestContext, 'principal.userRole') === roleName;
}

function isExternalGuest(requestContext) {
  return isRole(requestContext, 'guest');
}

function isInternalGuest(requestContext) {
  return isRole(requestContext, 'internal-guest');
}

function isExternalResearcher(requestContext) {
  return isRole(requestContext, 'external-researcher');
}

function isInternalResearcher(requestContext) {
  return isRole(requestContext, 'researcher');
}

function isAdmin(requestContext) {
  return isRole(requestContext, 'admin');
}

function isSystem(requestContext) {
  return _.get(requestContext, 'principalIdentifier.uid') === '_system_';
}

module.exports = {
  isInternalResearcher,
  isExternalResearcher,
  isInternalGuest,
  isExternalGuest,
  isAdmin,
  isSystem,
};
