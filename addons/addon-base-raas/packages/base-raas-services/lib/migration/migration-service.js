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

class MigrationService extends Service {
  constructor() {
    super();
    this.dependency(['studyOperationService']);
  }

  async migratePermissions(requestContext, migrationMappings) {
    const studyOperationService = await this.service('studyOperationService');

    const migrationResults = [];
    await Promise.all(
      migrationMappings.map(async item => {
        const result = await studyOperationService.updatePermissions(requestContext, item.studyId, {
          usersToAdd: [{ uid: item.uid, permissionLevel: 'admin' }],
          usersToRemove: [{ uid: '*', permissionLevel: 'admin' }],
        });
        migrationResults.push(result);
      }),
    );
    return migrationResults;
  }
}

module.exports = MigrationService;
