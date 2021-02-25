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

function isAdmin(requestContext) {
  return _.get(requestContext, 'principal.isAdmin', false);
}

function isCurrentUser(requestContext, { uid }) {
  return _.get(requestContext, 'principalIdentifier.uid') === uid;
}

function isCurrentUserOrAdmin(requestContext, { uid }) {
  return isAdmin(requestContext) || isCurrentUser(requestContext, { uid });
}

function isActive(requestContext) {
  return _.toLower(_.get(requestContext, 'principal.status', '')) === 'active';
}

function isRoot(requestContext) {
  return _.get(requestContext, 'principal.userType', '') === 'root';
}

function isSystem(requestContext) {
  return _.get(requestContext, 'principalIdentifier.uid') === '_system_';
}

function allow() {
  return {
    effect: 'allow',
  };
}

function deny(message, safe = false) {
  return {
    effect: 'deny',
    reason: {
      message,
      safe,
    },
  };
}

async function allowIfCreatorOrAdmin(requestContext, { action, resource }, item) {
  const itemCreator = _.get(item, 'createdBy');
  if (_.isEmpty(itemCreator)) {
    return deny(`Cannot ${action} the ${resource}. ${resource} creator information is not available`);
  }

  // Allow if the caller is the item creator (owner) or admin
  const permissionSoFar = await allowIfCurrentUserOrAdmin(requestContext, { action, resource }, { uid: itemCreator });
  if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

  return allow();
}

async function allowIfCurrentUserOrAdmin(requestContext, { action }, { uid }) {
  if (!isCurrentUserOrAdmin(requestContext, { uid })) {
    return deny(`Cannot perform the specified action "${action}". Only admins or current user can.`);
  }
  return allow();
}

async function allowIfCurrentUser(requestContext, { action }, { uid }) {
  if (!isCurrentUser(requestContext, { uid })) {
    return deny(`Cannot perform the specified action "${action}" on other user's resources.`);
  }
  return allow();
}

async function allowIfActive(requestContext, { action }) {
  // Make sure the current user is active
  if (!isActive(requestContext)) {
    return deny(`Cannot perform the specified action "${action}". The caller is not active.`);
  }
  return allow();
}

async function allowIfAdmin(requestContext, { action }) {
  if (!isAdmin(requestContext)) {
    return deny(`Cannot perform the specified action "${action}". Only admins can.`);
  }
  return allow();
}

async function allowIfRoot(requestContext, { action }) {
  if (!isRoot(requestContext)) {
    return deny(`Cannot perform the specified action "${action}". Only root user can.`);
  }
  return allow();
}

async function allowIfSystem(requestContext, { action }) {
  if (!isSystem(requestContext)) {
    return deny(`Cannot perform the specified action "${action}". Only system can.`);
  }
  return allow();
}

function isAllow({ effect }) {
  return _.toLower(effect) === 'allow';
}

function isDeny({ effect }) {
  return _.toLower(effect) === 'deny';
}

module.exports = {
  allow,
  deny,

  allowIfCreatorOrAdmin,
  allowIfCurrentUserOrAdmin,
  allowIfCurrentUser,
  allowIfActive,
  allowIfAdmin,
  allowIfRoot,
  allowIfSystem,

  isAllow,
  isDeny,

  isCurrentUser,
  isCurrentUserOrAdmin,
  isAdmin,
  isActive,
  isRoot,
  isSystem,
};
