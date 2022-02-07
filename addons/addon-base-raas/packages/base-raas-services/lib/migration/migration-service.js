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

const Service = require('@aws-ee/base-services-container/lib/service');
const { isAdmin } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const settingKeys = { studiesTableName: 'dbStudies', categoryIndexName: 'dbStudiesCategoryIndex' };

class MigrationService extends Service {
  constructor() {
    super();
    this.dependency(['studyOperationService', 'dbService', 'userService', 'studyService']);
  }

  async init() {
    await super.init();
    const dbService = await this.service('dbService');

    const studiesTable = this.settings.get(settingKeys.studiesTableName);
    this._getter = () => dbService.helper.getter().table(studiesTable);
    this._updater = () => dbService.helper.updater().table(studiesTable);
    this._query = () => dbService.helper.query().table(studiesTable);
    this._deleter = () => dbService.helper.deleter().table(studiesTable);
    this._scanner = () => dbService.helper.scanner().table(studiesTable);

    this.categoryIndex = this.settings.get(settingKeys.categoryIndexName);
  }

  async migrateMyStudiesPermissions(requestContext, migrationMappings) {
    if (!isAdmin(requestContext)) {
      throw this.boom.forbidden('You need admin permissions to migrate My Studies', true);
    }
    const studyOperationService = await this.service('studyOperationService');
    const userService = await this.service('userService');
    const studyService = await this.service('studyService');

    // append RequestContext to signify migraiton request
    requestContext.isMigration = true;

    const migrationResults = [];
    await Promise.all(
      migrationMappings.map(async item => {
        const endUser = item.uid;
        const studyId = item.studyId;
        if (await userService.isInternalAuthUser(endUser)) {
          throw this.boom.badRequest('You cannot migrate My Studies to internal user', true);
        }

        // check that end user is not already owner
        if (await studyService.isStudyAdmin(requestContext, studyId, endUser)) {
          throw this.boom.badRequest(`The study ${studyId} is already owned by ${endUser}`, true);
        }

        const result = await studyOperationService.updatePermissions(requestContext, studyId, {
          usersToAdd: [{ uid: endUser, permissionLevel: 'admin' }],
          usersToRemove: [{ uid: '*', permissionLevel: 'admin' }],
        });
        migrationResults.push(result);
      }),
    );
    return migrationResults;
  }

  async listMyStudies(requestContext) {
    if (!isAdmin(requestContext)) {
      throw this.boom.forbidden('You need admin permissions to list all My Studies in this environment', true);
    }

    const studyService = await this.service('studyService');
    const userService = await this.service('userService');

    const result = await this._query()
      .index(this.categoryIndex)
      .key('category', 'My Studies')
      .limit(1000)
      .query();

    const helpfulResult = await Promise.all(
      await result.map(async study => {
        const currentStudyPermissions = await studyService.getStudyPermissions(requestContext, study.id);
        const currentOwner = currentStudyPermissions.permissions.adminUsers[0];
        const currentOwnerInformation = await userService.findUser({ uid: currentOwner });
        const currentOwnerUsername = currentOwnerInformation.username;
        const currentOwnerAuthProvider =
          currentOwnerInformation.authenticationProviderId === 'internal'
            ? 'internal'
            : currentOwnerInformation.identityProviderName;

        return {
          studyId: study.id,
          uid: currentOwner,
          username: currentOwnerUsername,
          authProvider: currentOwnerAuthProvider,
        };
      }),
    );

    return helpfulResult.filter(study => study.authProvider === 'internal');
  }
}

module.exports = MigrationService;
