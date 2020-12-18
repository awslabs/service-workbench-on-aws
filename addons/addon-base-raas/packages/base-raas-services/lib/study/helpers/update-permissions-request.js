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
 * This file contains a collection of functions that are used when
 * trying to understand the state of the updateRequest object. This Update
 * request object is used when needing to update either the study permissions.
 * The update request object must confirm to the json shape described in the
 * schema/update-study-permissions.json file.
 */

const _ = require('lodash');

const { permissionLevels } = require('./entities/study-methods');
/**
 * This function gathers the user ids of all of the users listed in the usersToAdd
 * and usersToRemove in the update request object. It will then return them
 * but with no duplicate.
 *
 * @param updateRequest The update request that follows the shape as described here
 * schema/update-study-permissions.json
 */
function getImpactedUsers(updateRequest = {}) {
  const usersToAddIds = _.map(updateRequest.usersToAdd, item => item.uid);
  const usersToRemoveIds = _.map(updateRequest.usersToRemove, item => item.uid);

  return _.uniq([...usersToAddIds, ...usersToRemoveIds]);
}

/**
 * Mutates the userPermissionsEntity based on the information given in the
 * updateRequest object.
 *
 * @param updateRequest The update request that follows the shape as described here
 * schema/update-study-permissions.json
 * @param userPermissionsEntity The user permissions entity
 * @param studyId the study id that this
 */
function applyToUserPermissions(updateRequest, userPermissionsEntity, studyId) {
  const uid = userPermissionsEntity.uid || 'UNKNOWN';

  _.forEach(updateRequest.usersToAdd, item => {
    if (item.uid !== uid) return;
    const level = `${item.permissionLevel}Access`;
    userPermissionsEntity[level] = _.uniq([...(userPermissionsEntity[level] || []), studyId]);
  });

  _.forEach(updateRequest.usersToRemove, item => {
    if (item.uid !== uid) return;
    const level = `${item.permissionLevel}Access`;
    _.pull(userPermissionsEntity[level], studyId);
  });
}

function createUpdateRequest(studyPermissionsEntity = {}) {
  const add = [];

  _.forEach(permissionLevels, level => {
    add.push(
      ..._.map(studyPermissionsEntity[`${level}Users`], uid => ({
        uid,
        permissionLevel: level,
      })),
    );
  });

  return {
    usersToAdd: add,
  };
}

module.exports = {
  getImpactedUsers,
  applyToUserPermissions,
  createUpdateRequest,
};
