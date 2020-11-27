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
 * userPermissionEntity. Think of these functions as derived attributes
 * or functions that are part of the userPermissionEntity.
 */

const _ = require('lodash');

function getStudyIds(userPermissionsEntity = {}) {
  const adminAccess = userPermissionsEntity.adminAccess || [];
  const readonlyAccess = userPermissionsEntity.readonlyAccess || [];
  const readwriteAccess = userPermissionsEntity.readwriteAccess || [];
  const writeonlyAccess = userPermissionsEntity.writeonlyAccess || [];

  return _.uniq([...adminAccess, ...readonlyAccess, ...readwriteAccess, ...writeonlyAccess]);
}

function hasPermissions(userPermissionsEntity = {}, studyId) {
  const studyIds = getStudyIds(userPermissionsEntity);
  return _.includes(studyIds, studyId);
}

function getEmptyUserPermissions() {
  return {
    adminAccess: [],
    readonlyAccess: [],
    readwriteAccess: [],
    writeonlyAccess: [],
  };
}

module.exports = {
  hasPermissions,
  getStudyIds,
  getEmptyUserPermissions,
};
