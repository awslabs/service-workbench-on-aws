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
