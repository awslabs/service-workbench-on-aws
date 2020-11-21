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
const { allowIfActive } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const settingKeys = {
  tableName: 'dbStudyPermissions',
};

const toStudyPermissionsEntity = (studyEntity, dbEntity) => {
  const entity = _.omit(dbEntity, ['recordType', 'id']);
  // We now need to narrow the permissions based on the studyEntity.accessType.
  // We default to 'readwrite' if no value is specified, this is needed to be backward
  // compatible with existing internal studies.
  const accessType = _.get(studyEntity, 'accessType', 'readwrite');
  if (accessType === 'readonly') {
    entity.readwriteUsers = [];
    entity.writeonlyUsers = [];
  }

  return entity;
};

const composeStudyPermissionsKey = studyId => `Study:${studyId}`;
const composeUserPermissionsKey = uid => `User:${uid}`;
const isOpenData = studyEntity => _.get(studyEntity, 'category') === 'Open Data';

class StudyPermissionService extends Service {
  constructor() {
    super();
    this.dependency([
      'dbService',
      'jsonSchemaValidationService',
      'authorizationService',
      'auditWriterService',
      'studyAuthzService',
      'lockService',
      'userService',
    ]);
  }

  async init() {
    // Setup DB helpers
    const [dbService, studyAuthzService] = await this.service(['dbService', 'studyAuthzService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
    this._scanner = () => dbService.helper.scanner().table(table);

    // A private authorization condition function that just delegates to the studyAuthzService
    this.allowAuthorized = (requestContext, { resource, action, effect, reason }, ...args) =>
      studyAuthzService.authorize(requestContext, { resource, action, effect, reason }, ...args);
  }

  /**
   * This method returns the study permissions entity. If the study is an open data study,
   * undefined is returned. If the requestContext.principal is not an admin and does not have
   * any permissions for the study then this method throws an exception.
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
   */
  async findStudyPermissions(requestContext, studyEntity, fields = []) {
    // Authorization logic step 1:
    // - We do a quick check if the user is active, otherwise there is no need to waste a db call if
    //   the user is not active.
    await this.assertAuthorized(requestContext, { action: 'get-study-permissions', conditions: [allowIfActive] });

    if (isOpenData(studyEntity)) return undefined;

    const dbEntity = await this._getter()
      .key({ id: composeStudyPermissionsKey(studyEntity.id) })
      .projection(fields)
      .get();

    const studyPermissionsEntity = toStudyPermissionsEntity(studyEntity, dbEntity);

    // Authorization logic step 2:
    // - We load the study permissions entity from the database and then enforce the necessary authorization
    //   checks before returning the study permission entity
    await this.assertAuthorized(
      requestContext,
      {
        action: 'get-study-permissions',
        conditions: [this.allowAuthorized],
      },
      { studyEntity, studyPermissionsEntity },
    );

    return studyPermissionsEntity;
  }

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
