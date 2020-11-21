/* eslint-disable no-await-in-loop */
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

/**
 * This file contains a collection of functions that are used with the
 * studyPermissionEntity. Think of these functions as derived attributes
 * or functions that are part of the studyPermissionEntity.
 */

const _ = require('lodash');

function getUserIds(studyPermissionsEntity = {}) {
  const adminUsers = studyPermissionsEntity.adminUsers || [];
  const readonlyUsers = studyPermissionsEntity.readonlyUsers || [];
  const readwriteUsers = studyPermissionsEntity.readwriteUsers || [];
  const writeonlyUsers = studyPermissionsEntity.writeonlyUsers || [];

  return _.uniq([...adminUsers, ...readonlyUsers, ...readwriteUsers, ...writeonlyUsers]);
}

function hasAccess(uid, studyPermissionsEntity = {}) {
  const userIds = getUserIds(studyPermissionsEntity);
  return _.includes(userIds, uid);
}

module.exports = {
  hasAccess,
  getUserIds,
};
