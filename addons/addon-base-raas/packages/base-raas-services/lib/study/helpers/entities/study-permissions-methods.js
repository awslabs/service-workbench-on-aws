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

function hasPermissions(studyPermissionsEntity, uid) {
  const userIds = getUserIds(studyPermissionsEntity);
  return _.includes(userIds, uid);
}

function isAdmin(studyPermissionsEntity, uid) {
  const adminUsers = studyPermissionsEntity.adminUsers || [];
  return _.includes(adminUsers, uid);
}

/**
 * Mutates the studyPermissionsEntity based on the information given in the
 * updateRequest object.
 *
 * @param studyPermissionsEntity The study permissions entity
 * @param updateRequest The update request that follows the shape as described here
 * schema/update-study-permissions.json
 */
function applyUpdateRequest(studyPermissionsEntity, updateRequest) {
  const entity = studyPermissionsEntity;

  _.forEach(updateRequest.usersToAdd, item => {
    const level = `${item.permissionLevel}Users`;
    entity[level] = _.uniq([...(entity[level] || []), item.uid]);
  });

  _.forEach(updateRequest.usersToRemove, item => {
    const level = `${item.permissionLevel}Users`;
    _.pull(entity[level], item.uid);
  });
}

function getEmptyStudyPermissions() {
  return {
    adminUsers: [],
    readonlyUsers: [],
    readwriteUsers: [],
    writeonlyUsers: [],
  };
}

module.exports = {
  hasPermissions,
  isAdmin,
  getUserIds,
  applyUpdateRequest,
  getEmptyStudyPermissions,
};
