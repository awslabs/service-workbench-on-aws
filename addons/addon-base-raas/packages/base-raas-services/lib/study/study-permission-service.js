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

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');
const {
  allowIfActive,
  allowIfCurrentUserOrAdmin,
  allow,
  deny,
} = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const createSchema = require('../schema/create-study-permissions');
const updateSchema = require('../schema/update-study-permissions');
const getSchema = require('../schema/get-study-permissions');
const { isAdmin } = require('../helpers/is-role');
const { hasPermissions, isAdmin: isStudyAdmin } = require('./helpers/entities/study-permissions-methods');
const {
  getEmptyStudyPermissions,
  getUserIds,
  applyUpdateRequest,
} = require('./helpers/entities/study-permissions-methods');
const { getEmptyUserPermissions } = require('./helpers/entities/user-permissions-methods');
const {
  isOpenData,
  isReadonly,
  isWriteonly,
  isPermissionLevelSupported,
  permissionLevels,
} = require('./helpers/entities/study-methods');
const {
  getImpactedUsers,
  applyToUserPermissions,
  createUpdateRequest,
} = require('./helpers/update-permissions-request');

const settingKeys = {
  tableName: 'dbStudyPermissions',
};

const composeStudyPermissionsKey = studyId => `Study:${studyId}`;
const composeUserPermissionsKey = uid => `User:${uid}`;

const toStudyPermissionsEntity = (studyEntity, dbEntity = {}) => {
  if (isOpenData(studyEntity)) {
    return { ...getEmptyStudyPermissions() };
  }

  const entity = { ...getEmptyStudyPermissions(), ..._.omit(dbEntity, ['recordType', 'id']) };
  // We now need to narrow the permissions based on the studyEntity.accessType.
  // We default to 'readwrite' if no value is specified, this is needed to be backward
  // compatible with existing internal studies. Remember the accessType represents the
  // the maximum permissions allowed on the study.
  // Notice that when we have accessType = readwrite, we don't clear the readonly users
  // nor the writeonly users, this is because (as mentioned above) accessType presents
  // the maximum permissions allowed.
  if (isReadonly(studyEntity)) {
    // all users who had readwrite access need to be demoted to readonlyUsers
    if (!_.isEmpty(entity.readwriteUsers)) {
      entity.readonlyUsers = _.uniq([...entity.readonlyUsers, ...entity.readwriteUsers]);
      entity.readwriteUsers = [];
    }
    entity.writeonlyUsers = [];
  } else if (isWriteonly(studyEntity)) {
    // all users who had readwrite access need to be demoted to writeonlyUsers
    if (!_.isEmpty(entity.readwriteUsers)) {
      entity.writeonlyUsers = _.uniq([...entity.writeonlyUsers, ...entity.readwriteUsers]);
      entity.readwriteUsers = [];
    }
    entity.readonlyUsers = [];
  }

  return entity;
};

const toUserPermissionsEntity = (dbEntity = {}) => {
  const entity = _.omit(dbEntity, ['recordType', 'uid', 'id']);
  const uid = _.get(dbEntity, 'id', '').slice('User:'.length);
  return { ...getEmptyUserPermissions(), ...entity, uid };
};

/**
 * IMPORTANT: This is a strict service delegate. It means that it shouldn't be used or accessed
 * directly.  Only one service (the delegator) is expected to use this service. In this case,
 * the delegator service is the StudyService.  If you need access to any of the study entities
 * and permissions information, you should use the StudyService.
 *
 * This strict service delegate is responsible of managing the StudyPermissionsEntity and the
 * UserPermissionsEntity.
 */
class StudyPermissionService extends Service {
  constructor() {
    super();
    this.dependency([
      'dbService',
      'jsonSchemaValidationService',
      'authorizationService',
      'auditWriterService',
      'lockService',
      'userService',
    ]);
  }

  async init() {
    // Setup DB helpers
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);
  }

  /**
   * This method returns the study permissions entity. If the study is an open data study,
   * the study permissions entity will not have users in its admin/readonly/readwrite/writeonly attributes.
   * If the requestContext.principal is not an admin and does not have any permissions
   * for the study then this method throws an exception.
   *
   * The studyPermissionsEntity has the following shape:
   * {
   *  adminUsers: [<uid>, ...]
   *  readonlyUsers: [<uid>, ...]
   *  readwriteUsers: [<uid>, ...]
   *  writeonlyUsers: [<uid>, ...]
   *  updateBy, updateAt, createdBy, createdAt
   * }
   *
   * @param requestContext The standard requestContext
   * @param studyEntity The study entity object
   * @param fields An array of the attribute names to return, default to all the attributes
   * of the study permissions entity.
   */
  async findStudyPermissions(requestContext, studyEntity, fields = []) {
    const dbEntity = await this._getter()
      .key({ id: composeStudyPermissionsKey(studyEntity.id) })
      .projection(fields)
      .get();

    const studyPermissionsEntity = toStudyPermissionsEntity(studyEntity, dbEntity);

    // Perform authorization logic
    await this.assertAuthorized(
      requestContext,
      {
        action: 'get-study-permissions',
        conditions: [allowIfActive, this.allowFindStudyPermissions],
      },
      { studyEntity, studyPermissionsEntity },
    );

    return studyPermissionsEntity;
  }

  /**
   * This method returns the user permissions entity. Admins can call this method for
   * any user, however, if the requestContext.principal is not an admin and is not
   * the same as the given uid, an exception is thrown. If no user entry is found,
   * a userPermissionsEntity is returned but with no values in arrays such as adminAccess:[], etc.
   *
   * The userPermissionsEntity has the following shape:
   * {
   *  uid: <userId>,
   *  adminAccess: [<studyId>, ...]
   *  readonlyAccess: [<studyId>, ...]
   *  readwriteAccess: [<studyId>, ...]
   *  writeonlyAccess: [<studyId>, ...]
   *  updateBy, updateAt, createdBy, createdAt
   * }
   *
   * @param requestContext The standard requestContext
   * @param uid The user id
   * @param fields An array of the attribute names to return, default to all the attributes
   * of the user permissions entity.
   */
  async findUserPermissions(requestContext, uid, fields = []) {
    // Authorization logic
    await this.assertAuthorized(
      requestContext,
      {
        action: 'get-user-permissions',
        conditions: [allowIfActive, allowIfCurrentUserOrAdmin],
      },
      { uid },
    );

    const id = composeUserPermissionsKey(uid);
    const dbEntity = await this._getter()
      .key({ id })
      .projection(fields)
      .get();

    const userPermissionsEntity = toUserPermissionsEntity(dbEntity || { id });

    return userPermissionsEntity;
  }

  async preCreateValidation(requestContext, studyEntity, studyPermissionsEntity) {
    // If not an active user, throw an exception.
    await this.assertAuthorized(requestContext, { action: 'create-study-permissions', conditions: [allowIfActive] });

    const adminUsers = studyPermissionsEntity.adminUsers;

    if (_.isEmpty(adminUsers)) {
      throw this.boom.badRequest('You must provide at least one admin for the study', true);
    }

    const userIds = getUserIds(studyPermissionsEntity);
    if (_.size(userIds) > 100) {
      // To protect against a large number
      throw this.boom.badRequest('You can only specify up to 100 users', true);
    }

    // All users should be active and either have an admin or a researcher role
    await this.assertValidUsers(userIds);

    // Depending on the study.accessType, we want to detect if we are trying to give
    // users permissions that are not supported by the study.
    _.forEach(permissionLevels, level => {
      if (!isPermissionLevelSupported(studyEntity, level)) {
        if (!_.isEmpty(studyPermissionsEntity[`${level}Users`])) {
          throw this.boom.badRequest(`The study does not support ${level}`, true);
        }
      }
    });

    this.assertNoMultipleLevels(studyPermissionsEntity);
  }

  /**
   * This method creates the study permission entity. However, this method assumes that the
   * 'preCreateValidation' has already been called on the raw entity provided.
   *
   * @param requestContext The standard requestContext
   * @param studyEntity The study entity object
   * @param rawEntity The proposed study permission entity to create. The proposed study permission
   * entity should have the following shape:
   * {
   *  adminUsers: [<uid>, ...]
   *  readonlyUsers: [<uid>, ...]
   *  readwriteUsers: [<uid>, ...]
   *  writeonlyUsers: [<uid>, ...]
   * }
   */
  async create(requestContext, studyEntity, rawEntity) {
    // If not an active user, throw an exception.
    await this.assertAuthorized(requestContext, { action: 'create-study-permissions', conditions: [allowIfActive] });

    // Open data studies can't have user permissions
    if (isOpenData(studyEntity)) {
      throw this.boom.badRequest(`Open Data studies can not have user permissions`, true);
    }

    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid(rawEntity, createSchema);

    const by = _.get(requestContext, 'principalIdentifier.uid');
    const entity = {
      adminUsers: _.uniq(rawEntity.adminUsers),
      readonlyUsers: _.uniq(rawEntity.readonlyUsers),
      readwriteUsers: _.uniq(rawEntity.readwriteUsers),
      writeonlyUsers: _.uniq(rawEntity.writeonlyUsers),
      recordType: 'study',
      createdBy: by,
      updatedBy: by,
    };

    // Time to save the db object
    const dbEntity = await runAndCatch(
      async () => {
        return this._updater()
          .condition('attribute_not_exists(id)') // allows us to detect if an entry was already there
          .key({ id: composeStudyPermissionsKey(studyEntity.id) })
          .item(entity)
          .update();
      },
      async () => {
        throw this.boom.alreadyExists(`Permission record for study with id "${studyEntity.id}" already exists`, true);
      },
    );
    const studyPermissionsEntity = toStudyPermissionsEntity(studyEntity, dbEntity);

    const updateRequest = createUpdateRequest(studyPermissionsEntity);
    const ops = await this.getUserPermissionsUpdateOps(requestContext, studyEntity, updateRequest);
    await this.runUpdateOps(ops);

    return studyPermissionsEntity;
  }

  /**
   * This method updates the study permission entity.
   *
   * @param requestContext The standard requestContext
   * @param studyEntity The study entity object
   * @param updateRequest The updateRequest object containing the information about which users to add/remove
   * including permission levels for the given study entity.
   *
   * The updateRequest should have the following shape:
   * {
   *  usersToAdd: [ {uid, permissionLevel}, ...]
   *  usersToRemove: [ {uid, permissionLevel}, ...]
   * }
   */
  async update(requestContext, studyEntity, updateRequest) {
    // Validate input
    const [validationService, lockService] = await this.service(['jsonSchemaValidationService', 'lockService']);
    await validationService.ensureValid(updateRequest, updateSchema);
    await validationService.ensureValid({ id: studyEntity.id }, getSchema);

    const lockId = `study-${studyEntity.id}`;
    const entity = await lockService.tryWriteLockAndRun({ id: lockId }, async () => {
      const studyPermissionsEntity = await this.findStudyPermissions(requestContext, studyEntity);
      await this.assertAuthorized(
        requestContext,
        {
          action: 'update-study-permissions',
          conditions: [allowIfActive, this.allowUpdate],
        },
        { studyEntity, studyPermissionsEntity },
      );

      applyUpdateRequest(studyPermissionsEntity, updateRequest);

      const userIds = getImpactedUsers(updateRequest);
      if (_.size(userIds) > 100) {
        // To protect against a large number
        throw this.boom.badRequest('You can only change permissions for up to 100 users', true);
      }

      // All users should be active and either have an admin or a researcher role
      await this.assertValidUsers(userIds);

      // Depending on the study.accessType, we want to detect if we are trying to give
      // users permissions that are not supported by the study.
      _.forEach(permissionLevels, level => {
        if (!isPermissionLevelSupported(studyEntity, level)) {
          if (!_.isEmpty(studyPermissionsEntity[`${level}Users`])) {
            throw this.boom.badRequest(`The study does not support ${level}`, true);
          }
        }
      });

      this.assertNoMultipleLevels(studyPermissionsEntity);

      const by = _.get(requestContext, 'principalIdentifier.uid');

      // Time to save the db object
      const dbEntity = await this._updater()
        .key({ id: composeStudyPermissionsKey(studyEntity.id) })
        .item({
          ..._.omit(studyPermissionsEntity, ['updatedBy', 'updatedAt', 'createdAt', 'createdBy']),
          updatedBy: by,
        })
        .update();
      const updatedEntity = toStudyPermissionsEntity(studyEntity, dbEntity);

      const ops = await this.getUserPermissionsUpdateOps(requestContext, studyEntity, updateRequest);
      await this.runUpdateOps(ops);

      return updatedEntity;
    });

    return entity;
  }

  // @private
  // This method assumes that the updateRequest shape has been validated already
  // via the json schema validation service.  It returns an array of functions (a.k.a operations).
  // Later when these functions are called, they update the UserPermissionsEntity in the database.
  async getUserPermissionsUpdateOps(requestContext, studyEntity, updateRequest) {
    const [lockService] = await this.service(['lockService']);
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const userIds = getImpactedUsers(updateRequest);
    const getOperation = uid => {
      // getOperation returns a function that can be called later to run the actual update logic.
      return async () => {
        // Summary of the logic:
        // - load user permissions entity
        // - apply update request
        // - store in database
        // Load the user permission entity
        const lockId = `study-user-permission-${uid}`;
        return lockService.tryWriteLockAndRun({ id: lockId }, async () => {
          const id = composeUserPermissionsKey(uid);
          let dbEntity = await this._getter()
            .key({ id })
            .projection()
            .get();
          const userPermissionsEntity = toUserPermissionsEntity(dbEntity || { id });

          // Apply the update to the user permission entity
          applyToUserPermissions(updateRequest, userPermissionsEntity, studyEntity.id);

          // Store it in the database
          const entity = {
            ...userPermissionsEntity,
            recordType: 'user',
            createdBy: by,
            updatedBy: by,
          };

          // Time to save the the db object
          dbEntity = await this._updater()
            .key({ id: composeUserPermissionsKey(uid) })
            .item(entity)
            .update();

          return toUserPermissionsEntity(dbEntity || { id });
        });
      };
    };

    return _.map(userIds, getOperation);
  }

  // @private
  // Given an array of the operations (functions), run them in chunks and keep track of errors.
  async runUpdateOps(ops) {
    const chunks = _.chunk(ops, 10); // Run 10 operations at a time
    const errors = [];
    const run = async op => {
      try {
        await op();
      } catch (error) {
        errors.push(error.message);
      }
    };

    while (!_.isEmpty(chunks)) {
      const chunk = chunks.shift();
      await Promise.all(_.map(chunk, run));
    }

    if (!_.isEmpty(errors)) {
      throw this.boom.badRequest(errors.join('. '), true);
    }
  }

  // @private
  // This method takes a list of user ids (can be up to a 100 user ids) and validates that
  // these user ids belong to active users with either the role of ‘admin’ or ‘researcher’.
  async assertValidUsers(userIds = []) {
    if (_.size(userIds) > 100) {
      throw this.boom.badRequest(`Too many users, only up to a 100 users can be provided`, true);
    }

    const userService = await this.service('userService');

    // We now check all the user ids to ensure they exist, active and either have the
    // role of application admin or a researcher. We do the lookup 10 users at a time.
    const chunks = _.chunk(userIds, 10);
    const errors = [];
    const validateUser = async uid => {
      try {
        // TODO - future: add a batchGet to the userService
        const user = await userService.mustFindUser({ uid });
        const isAdminUser = user.isAdmin;
        const isActive = _.toLower(user.status) === 'active';
        const isResearcher = user.userRole === 'researcher';
        if (!(isActive && (isAdminUser || isResearcher))) {
          throw this.boom.badRequest(
            `User ${user.username} must be active and either has the role of admin or the role of researcher`,
            true,
          );
        }
      } catch (error) {
        errors.push(error.message);
      }
    };

    while (!_.isEmpty(chunks)) {
      const chunk = chunks.shift();
      await Promise.all(_.map(chunk, validateUser));
    }

    if (!_.isEmpty(errors)) {
      throw this.boom.badRequest(errors.join('. '), true);
    }
  }

  // @private
  // Check that we don't have users appearing in multiple level of permissions. For example,
  // a user can not be readonly and readwrite at the same time (being admin is okay).
  assertNoMultipleLevels(studyPermissionsEntity) {
    const entity = studyPermissionsEntity;
    // We keep track of the users we see by adding them to the map
    const map = {};
    const violation = [];
    _.forEach(permissionLevels, level => {
      if (level === 'admin') return;
      _.forEach(entity[`${level}Users`], uid => {
        if (_.has(map, uid)) violation.push(uid);
        else map[uid] = level;
      });
    });

    if (_.isEmpty(violation)) return;

    throw this.boom.badRequest(`${_.size(_.uniq(violation))} user(s) have multiple permissions`, true);
  }

  // @private
  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'study-authz', action, conditions },
      ...args,
    );
  }

  async allowFindStudyPermissions(requestContext, context, { studyEntity, studyPermissionsEntity = {} } = {}) {
    if (isOpenData(studyEntity)) return allow();
    if (isAdmin(requestContext)) return allow();
    const uid = _.get(requestContext, 'principalIdentifier.uid');

    if (hasPermissions(studyPermissionsEntity, uid)) return allow();

    return deny('You do not have permission to view the study access information', true);
  }

  async allowUpdate(requestContext, context, { studyEntity, studyPermissionsEntity = {} } = {}) {
    if (isOpenData(studyEntity)) return deny('You can not change study permissions for an open data study', true);
    if (isAdmin(requestContext)) return allow(); // Application admins can do the update
    const uid = _.get(requestContext, 'principalIdentifier.uid');

    if (isStudyAdmin(studyPermissionsEntity, uid)) return allow();

    return deny('You do not have permission to update the study permission', true);
  }

  // @private
  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = StudyPermissionService;
