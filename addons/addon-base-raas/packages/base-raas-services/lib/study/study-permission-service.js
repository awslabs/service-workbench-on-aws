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
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const updateSchema = require('../schema/update-study-permissions');

const settingKeys = {
  tableName: 'dbStudyPermissions',
};

// The StudyPermissions table has study permissions records stored both ways to answer following questions easily
// 1. Given a study, give me all users who have admin and/or readonly access. These records are stored with study id as partition key. In this case, the id attribute in DDB has format "Study:<study-id>".
// 2. Given a user, give ma all studies it has admin and/or readonly access to. These records are stored with user id as partition key. In this case, the id attribute in DDB has format "User:<uid>".
const keyPrefixes = {
  study: 'Study:',
  user: 'User:',
};
const permissionLevels = ['admin', 'readonly', 'writeonly', 'readwrite'];

class StudyPermissionService extends Service {
  constructor() {
    super();
    this.dependency(['dbService', 'jsonSchemaValidationService', 'lockService']);
  }

  async init() {
    // Get services
    this.jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    this.lockService = await this.service('lockService');

    // Setup DB helpers
    const dbService = await this.service('dbService');
    this.tableName = this.settings.get(settingKeys.tableName);
    this._getter = () => dbService.helper.getter().table(this.tableName);
    this._updater = () => dbService.helper.updater().table(this.tableName);
    this._query = () => dbService.helper.query().table(this.tableName);
    this._deleter = () => dbService.helper.deleter().table(this.tableName);
    this._scanner = () => dbService.helper.scanner().table(this.tableName);
  }

  /**
   * Public Methods
   */
  async findByStudy(requestContext, studyId, fields = []) {
    const id = StudyPermissionService.getQualifiedKey(studyId, 'study');
    const record = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    return StudyPermissionService.sanitizeStudyRecord(record);
  }

  async findByUser(requestContext, uid, fields = []) {
    const id = StudyPermissionService.getQualifiedKey(uid, 'user');
    return this._getter()
      .key({ id })
      .projection(fields)
      .get();
  }

  async create(requestContext, studyId) {
    let result;

    // Build study record
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const studyRecord = {
      id: StudyPermissionService.getQualifiedKey(studyId, 'study'),
      recordType: 'study',
      adminUsers: [by],
      readonlyUsers: [],
      writeonlyUsers: [],
      readwriteUsers: [],
      createdBy: by,
    };

    // Create DB records
    await Promise.all([
      // Create/Update user record
      this.upsertUserRecord(requestContext, {
        studyId,
        uid: by,
        addOrRemove: 'add',
        permissionLevel: 'admin',
      }),

      // Create study record
      runAndCatch(
        async () => {
          result = await this._updater()
            .condition('attribute_not_exists(id)') // Error if already exists
            .key({ id: studyRecord.id })
            .item(studyRecord)
            .update();
        },
        async () => {
          throw this.boom.badRequest(`Permission record for study with id "${studyRecord.id}" already exists`, true);
        },
      ),
    ]);

    // Return study record
    return StudyPermissionService.sanitizeStudyRecord(result);
  }

  async update(requestContext, studyId, updateRequest) {
    let result;

    // Validate input
    await this.jsonSchemaValidationService.ensureValid(updateRequest, updateSchema);

    // Create DB lock before pulling existing record
    const lockKey = this.getLockKey(studyId, 'study');

    await this.lockService.tryWriteLockAndRun({ id: lockKey }, async () => {
      // Get existing record
      const studyRecord = await this.findByStudy(requestContext, studyId);

      // Build updated study record
      const by = _.get(requestContext, 'principalIdentifier.uid');
      studyRecord.updatedBy = by;

      const filterByLevel = filterLevel => userEntry => userEntry.permissionLevel === filterLevel;
      permissionLevels.forEach(permissionLevel => {
        studyRecord[`${permissionLevel}Users`] = _.pullAllWith(
          // Existing/Added users
          _.unionWith(
            studyRecord[`${permissionLevel}Users`],
            updateRequest.usersToAdd.filter(filterByLevel(permissionLevel)).map(userEntry => userEntry.uid),
            _.isEqual,
          ),

          // Removed users
          updateRequest.usersToRemove.filter(filterByLevel(permissionLevel)).map(userEntry => userEntry.uid),
          _.isEqual,
        );
      });

      // make sure that each user has either readonly, writeonly or readwrite permission
      this.validateUpdateRequest(studyRecord);

      // Halt the update if all admins have been removed
      if (studyRecord.adminUsers.length < 1) {
        throw this.boom.badRequest('At least one Admin must be assigned to the study', true);
      }

      // Update DB records
      result = await Promise.all([
        // Update study record
        this._updater()
          .key({ id: StudyPermissionService.getQualifiedKey(studyRecord.id, 'study') })
          .item(studyRecord)
          .update(),

        // Update user records
        ...updateRequest.usersToRemove.map(userEntry =>
          this.upsertUserRecord(requestContext, {
            studyId,
            uid: userEntry.uid,
            addOrRemove: 'remove',
            permissionLevel: userEntry.permissionLevel,
          }),
        ),
        ...updateRequest.usersToAdd.map(userEntry =>
          this.upsertUserRecord(requestContext, {
            studyId,
            uid: userEntry.uid,
            addOrRemove: 'add',
            permissionLevel: userEntry.permissionLevel,
          }),
        ),
      ]);
    });
    // Return study record
    return StudyPermissionService.sanitizeStudyRecord(result[0]);
  }

  async delete(requestContext, studyId) {
    let result;

    // Create DB lock before pulling existing record
    const lockKey = this.getLockKey(studyId, 'study');
    await this.lockService.tryWriteLockAndRun({ id: lockKey }, async () => {
      // Get record
      const studyRecord = await this.findByStudy(requestContext, studyId);

      // Delete
      result = await Promise.all([
        // Delete study record
        this._deleter()
          .key({ id: StudyPermissionService.getQualifiedKey(studyId, 'study') })
          .delete(),

        // Remove study from user records
        permissionLevels.forEach(permissionLevel => {
          if (studyRecord[`${permissionLevel}Users`]) {
            studyRecord[`${permissionLevel}Users`].map(async ({ uid }) =>
              this.upsertUserRecord(requestContext, {
                studyId,
                uid,
                addOrRemove: 'remove',
                permissionLevel: `${permissionLevel}`,
              }),
            );
          }
        }),
      ]);
    });

    // Return study record
    return StudyPermissionService.sanitizeStudyRecord(result[0]);
  }

  async getRequestorPermissions(requestContext) {
    return this.findByUser(
      requestContext,
      requestContext.principalIdentifier.uid,
      permissionLevels.map(level => level.concat('Access')),
    );
  }

  async verifyRequestorAccess(requestContext, studyId, action) {
    const mutatingActions = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const writeUserActions = ['UPLOAD'];
    const nonMutatingActions = ['GET'];
    const notFoundError = this.boom.notFound(`Study with id "${studyId}" does not exist`, true);
    const forbiddenError = this.boom.forbidden();

    // Ensure a valid action was passed
    if (!mutatingActions.concat(nonMutatingActions.concat(writeUserActions)).includes(action)) {
      throw this.boom.internalError(`Invalid action passed to verifyRequestorAccess(): ${action}`);
    }

    // Get user permissions
    const permissions = await this.getRequestorPermissions(requestContext);
    if (!permissions) {
      throw notFoundError;
    }

    // Check whether user has any access
    const hasAdminAccess = permissions.adminAccess.some(accessibleId => accessibleId === studyId);
    const hasReadonlyAccess = permissions.readonlyAccess.some(accessibleId => accessibleId === studyId);
    const hasWriteOnlyAccess =
      permissions.writeonlyAccess && permissions.writeonlyAccess.some(accessibleId => accessibleId === studyId);
    const hasReadWriteAccess =
      permissions.readwriteAccess && permissions.readwriteAccess.some(accessibleId => accessibleId === studyId);

    if (!(hasAdminAccess || hasReadonlyAccess || hasWriteOnlyAccess || hasReadWriteAccess)) {
      throw notFoundError;
    }

    // Deny mutating actions to non-admin users
    if (!hasAdminAccess && mutatingActions.includes(action)) {
      throw forbiddenError;
    }

    // Deny writeUser actions like Upload to users unless they are admin or they have write access
    if (!(hasReadWriteAccess || hasWriteOnlyAccess || hasAdminAccess) && writeUserActions.includes(action)) {
      throw forbiddenError;
    }
  }

  getEmptyUserPermissions() {
    return { adminAccess: [], readonlyAccess: [], writeonlyAccess: [], readwriteAccess: [] };
  }

  /**
   * Private Methods
   */
  async upsertUserRecord(requestContext, { studyId, uid, addOrRemove, permissionLevel }) {
    // Create DB lock before pulling existing record
    let result;
    const lockKey = this.getLockKey(uid, 'user');
    await this.lockService.tryWriteLockAndRun({ id: lockKey }, async () => {
      // Check for existing record; build new record if necessary
      let record = await this.findByUser(requestContext, uid);
      if (!record) {
        record = {
          id: StudyPermissionService.getQualifiedKey(uid, 'user'),
          recordType: 'user',
          uid,
          ...this.getEmptyUserPermissions(),
        };
      }

      // Deterrmine permission level
      if (!permissionLevels.includes(permissionLevel)) {
        throw this.boom.internalError('Bad permission level passed to _upsertUserRecord:', permissionLevel);
      }
      const permissionLevelKey = `${permissionLevel}Access`;

      // Add or remove permissions from user record
      switch (addOrRemove) {
        case 'add':
          record[permissionLevelKey] = _.union(record[permissionLevelKey], [studyId]);
          break;
        case 'remove':
          _.pull(record[permissionLevelKey], studyId);
          break;
        default:
          throw this.boom.internalError('Bad addOrRemove value passed to _upsertUserRecord:', addOrRemove);
      }

      // Update database
      result = await this._updater()
        .key({ id: record.id })
        .item(record)
        .update();
    });

    return result;
  }

  static getQualifiedKey(studyOrUserId, recordType) {
    // recordType must be 'study' or 'user'
    if (!(recordType in keyPrefixes)) {
      throw this.boom.internalError('Bad record type passed to getQualifiedKey:', recordType);
    }

    return `${keyPrefixes[recordType]}${studyOrUserId}`;
  }

  static sanitizeStudyRecord(record) {
    // Delete recordType and remove key prefix since they're just used for
    //   internal indexing
    delete record.recordType;
    record.id = record.id.slice(keyPrefixes.study.length);
    return record;
  }

  getLockKey(studyOrUserId, recordType) {
    return `${this.tableName}|${StudyPermissionService.getQualifiedKey(studyOrUserId, recordType)}`;
  }

  // validates if users to be added are valid by going through all the non-admin permission levels and
  // ensuring that a single user isn't specified twice
  validateUpdateRequest(studyRecord) {
    const userIdToPermissionsMap = permissionLevels
      .filter(permissionLevel => permissionLevel !== 'admin')
      .filter(permissionLevel => studyRecord[`${permissionLevel}Users`] !== undefined)
      .reduce(function(userIdToPermissionsMapLocal, permissionLevel) {
        studyRecord[`${permissionLevel}Users`].forEach(uid => {
          if (uid in userIdToPermissionsMapLocal) {
            userIdToPermissionsMapLocal[uid].push(permissionLevel);
          } else {
            userIdToPermissionsMapLocal[uid] = [permissionLevel];
          }
        });
        return userIdToPermissionsMapLocal;
      }, {});

    const errorString = Object.entries(userIdToPermissionsMap)
      .filter(([, permissions]) => permissions.length > 1)
      .map(([userId, permissions]) => `User ${userId} cannot have multiple permissions: ${permissions.join(',')}`)
      .join('\n');
    if (errorString.length > 0) {
      throw this.boom.badRequest(errorString, true);
    }
  }
}

module.exports = StudyPermissionService;
