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
 * studyEntity. Think of these functions as derived attributes
 * or functions that are part of the studyEntity.
 */

const _ = require('lodash');

const permissionLevels = ['admin', 'readonly', 'writeonly', 'readwrite'];

function hasAccess(studyEntity, uid) {
  // TODO consider the accessType of the study
  // and the My Studies
}

function accessLevels(studyEntity, uid) {
  // TODO consider the accessType of the study
  // TODO consider the My Studies => writable: true
  // should return something like  { admin: true/false, readable: true/false, writable: true/false }
}

function isOpenData(studyEntity = {}) {
  return studyEntity.category === 'Open Data';
}

function isReadonly(studyEntity = {}) {
  // Due to backward compatibility, not all studyEntity have the property 'accessType', therefore,
  // by default the accessType if not found is readwrite. Remember the accessType represents the
  // the max permissions allowed on the study.
  const accessType = _.get(studyEntity, 'accessType', 'readwrite');
  return accessType === 'readonly';
}

function isWriteonly(studyEntity = {}) {
  // Due to backward compatibility, not all studyEntity have the property 'accessType', therefore,
  // by default the accessType if not found is readwrite. Remember the accessType represents the
  // the max permissions allowed on the study.
  const accessType = _.get(studyEntity, 'accessType', 'readwrite');
  return accessType === 'writeonly';
}

function isPermissionLevelSupported(studyEntity, permissionLevel) {
  const readonly = isReadonly(studyEntity);
  const writeonly = isWriteonly(studyEntity);

  if (readonly && (permissionLevel === 'readwrite' || permissionLevel === 'writeonly')) return false;
  if (writeonly && (permissionLevel === 'readwrite' || permissionLevel === 'readonly')) return false;

  return true;
}

module.exports = {
  hasAccess,
  isOpenData,
  accessLevels,
  isReadonly,
  isWriteonly,
  isPermissionLevelSupported,
  permissionLevels,
};
