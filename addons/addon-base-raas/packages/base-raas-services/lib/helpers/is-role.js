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
