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

const { getEmptyStudyPermissions, hasPermissions } = require('./study-permissions-methods');

const permissionLevels = ['admin', 'readonly', 'writeonly', 'readwrite'];

/**
 * Returns true if the user id has access to the study otherwise it returns false.
 * This function considers many scenarios such as 'Open Data' studies and the
 * accessType value specified in the study.  For example, if the accessType is
 * readonly and yet the study permissions has this user listed in readwriteUsers,
 * the function still returns false since the accessType determines the maximum permission
 * level for the study.
 *
 * @param studyEntity The study entity with the permissions property populated
 * @param uid The user id
 */
function hasAccess(studyEntity = {}, uid) {
  if (isOpenData(studyEntity)) return true;
  const permissions = { ...getEmptyStudyPermissions(), ..._.cloneDeep(studyEntity.permissions) };
  const adminUsers = permissions.adminUsers;

  if (_.includes(adminUsers, uid)) return true; // study admins have access

  // To make the logic easier to implement, we first clear all permissions levels
  // that are above the maximum level (accessType).
  // Notice that when we have accessType = readwrite, we don't clear the readonly users
  // nor the writeonly users, this is because (as mentioned above) accessType presents
  // the maximum permissions allowed.
  if (isReadonly(studyEntity)) {
    permissions.writeonlyUsers = [];
    // We keep readwrite permissions because a user who has readwrite permissions
    // should be able to read
  } else if (isWriteonly(studyEntity)) {
    permissions.readonlyUsers = [];
    // We keep readwrite permissions because a user who has readwrite permissions
    // should be able to write
  }

  return hasPermissions(permissions, uid);
}

/**
 * Returns { admin, read, write } flags that reflect the permissions of the given user
 * for the given study entity. This function addresses all the scenarios such as 'Open Data'
 * studies and implicit permissions for study admins. For example, if study category
 * is 'My Studies' and the user is the study admin then the returned flags are:
 * { admin: true, read: true, write: true } given the fact that accessType is readwrite.
 * Study admins get implicit 'read = true' for Organization studies (if accessType is readwrite),
 * and get implicit 'read = true and write = true' for My Studies (if accessType is readwrite).
 *
 * @param studyEntity The study entity with the permissions property populated
 * @param uid The use id
 */
function accessLevels(studyEntity, uid) {
  if (isOpenData(studyEntity)) return { admin: false, read: true, write: false };
  const permissions = { ...getEmptyStudyPermissions(), ..._.cloneDeep(studyEntity.permissions) };
  const isAdmin = _.includes(permissions.adminUsers, uid);

  if (isAdmin) {
    // A study admin will implicitly have read access to the study unless the study accessType
    // is writeonly, in that case, the study admin will implicitly have write access (unless
    // it is open data). If the study is 'My Studies' then the admin will also implicitly have
    // write access (unless it is open data or readonly accessType).
    permissions.readonlyUsers.push(uid);
    if (isWriteonly(studyEntity)) permissions.writeonlyUsers.push(uid);
    if (isMyStudies(studyEntity)) permissions.readwriteUsers.push(uid);
  }

  // To make the logic easier to implement, we first clear all permissions levels
  // that are above the maximum level (accessType).
  // Notice that when we have accessType = readwrite, we don't clear the readonly users
  // nor the writeonly users, this is because (as mentioned above) accessType presents
  // the maximum permissions allowed.
  if (isReadonly(studyEntity)) {
    // all users who had readwrite access need to be demoted to readonlyUsers
    if (!_.isEmpty(permissions.readwriteUsers)) {
      permissions.readonlyUsers = _.uniq([...permissions.readonlyUsers, ...permissions.readwriteUsers]);
      permissions.readwriteUsers = [];
    }
    permissions.writeonlyUsers = [];
  } else if (isWriteonly(studyEntity)) {
    // all users who had readwrite access need to be demoted to writeonlyUsers
    if (!_.isEmpty(permissions.readwriteUsers)) {
      permissions.writeonlyUsers = _.uniq([...permissions.writeonlyUsers, ...permissions.readwriteUsers]);
      permissions.readwriteUsers = [];
    }
    permissions.readonlyUsers = [];
  }

  return {
    admin: isAdmin,
    read: _.includes(permissions.readonlyUsers, uid) || _.includes(permissions.readwriteUsers, uid),
    write: _.includes(permissions.writeonlyUsers, uid) || _.includes(permissions.readwriteUsers, uid),
  };
}

function isOpenData(studyEntity = {}) {
  return studyEntity.category === 'Open Data';
}

function isMyStudies(studyEntity = {}) {
  return studyEntity.category === 'My Studies';
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

function isReadwrite(studyEntity = {}) {
  // Due to backward compatibility, not all studyEntity have the property 'accessType', therefore,
  // by default the accessType if not found is readwrite. Remember the accessType represents the
  // the max permissions allowed on the study.
  const accessType = _.get(studyEntity, 'accessType', 'readwrite');
  return accessType === 'readwrite';
}

function isPermissionLevelSupported(studyEntity, permissionLevel) {
  const readonly = isReadonly(studyEntity);
  const writeonly = isWriteonly(studyEntity);

  if (readonly && (permissionLevel === 'readwrite' || permissionLevel === 'writeonly')) return false;
  if (writeonly && (permissionLevel === 'readwrite' || permissionLevel === 'readonly')) return false;

  return true;
}

function toStudyEntity(dbEntity) {
  if (!_.isObject(dbEntity)) return dbEntity;

  const entity = { ...dbEntity };
  if (_.isEmpty(entity.status)) {
    // We always default to reachable in the status.
    // Remember that we use the 'status' attribute in the index and we need to ensure
    // that when status == reachable that we remove the status attribute from the database
    entity.status = 'reachable';
  }

  return entity;
}

function toDbEntity(studyEntity, overridingProps = {}) {
  const dbEntity = { ...studyEntity, ...overridingProps };
  // Remember that we use the 'status' attribute in the index and we need to ensure
  // that when status == reachable that we remove the status attribute from the database
  if (dbEntity.status === 'reachable') {
    delete dbEntity.status;
  }

  const statusMsg = dbEntity.statusMsg;
  if (_.isString(statusMsg) && _.isEmpty(statusMsg)) {
    delete dbEntity.statusMsg;
  }

  return dbEntity;
}

module.exports = {
  hasAccess,
  isOpenData,
  isMyStudies,
  accessLevels,
  isReadonly,
  isWriteonly,
  isReadwrite,
  isPermissionLevelSupported,
  permissionLevels,
  toStudyEntity,
  toDbEntity,
};
