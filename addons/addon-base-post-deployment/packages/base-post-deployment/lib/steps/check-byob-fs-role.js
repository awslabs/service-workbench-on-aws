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
const Service = require('@amzn/base-services-container/lib/service');
const { getSystemRequestContext } = require('@amzn/base-services/lib/helpers/system-context');

/* eslint max-classes-per-file: ["error", 2] */
class ValidationError extends Error {
  constructor(code = '', message = '') {
    super();
    this.name = 'ValidationError';
    this.code = code;
    this.message = message;
    this.date = new Date();
  }
}

class CheckByobFsRole extends Service {
  constructor() {
    super();
    this.dependency(['dataSourceAccountService', 'roles-only/filesystemRoleService', 'deploymentStoreService']);
  }

  async checkExistingFsRoles() {
    const [dataSourceAccountService, filesystemRoleService] = await this.service([
      'dataSourceAccountService',
      'roles-only/filesystemRoleService',
    ]);

    let shouldUpgrade = true;
    shouldUpgrade = await this.shouldUpgrade();
    if (!shouldUpgrade) {
      this.log.info(`Data Source studies' filesystem role check is not needed. Skipping.`);
      return;
    }

    const requestContext = getSystemRequestContext();
    const accountList = await dataSourceAccountService.list(requestContext);
    const accountIdList = _.map(accountList, 'id');

    const roleEntitiesToDelete = [];
    await Promise.all(
      _.map(accountIdList, async accountId => {
        const fsRoleEntities = await filesystemRoleService.list(requestContext, accountId);
        _.forEach(fsRoleEntities, entity => {
          roleEntitiesToDelete.push({ pk: entity.accountId, sk: `${entity.bucket}#${entity.arn}` });
        });
        this.log.info(roleEntitiesToDelete);
      }),
    );

    if (!_.isEmpty(roleEntitiesToDelete)) {
      throw new ValidationError(
        'PreRequisiteNotComplete',
        `Please terminate all environments that are using BYOB (Data Source registered) studies, or rollback the installation. The following roles were found in the 
        DDB table suffixed 'RoleAllocations' which suggest environments using BYOB studies still exist:
        ${JSON.stringify(roleEntitiesToDelete)}`,
      );
    }

    await this.saveDeploymentItem({ id: 'status', value: 'completed' });
  }

  async findDeploymentItem(id) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    const result = await deploymentStore.find({ type: 'byob-filesystem-role-check', id });

    return _.get(result, 'value');
  }

  async saveDeploymentItem({ id, value }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.createOrUpdate({ type: 'byob-filesystem-role-check', id, value });
  }

  // Determines if the upgrade should be attempted. The logic is as follows:
  // - For first time install, this check will be marked completed since there will not be any fs roles
  // - For upgrade install, this check will be required unless already marked completed before
  async shouldUpgrade() {
    // Do we have a status = 'completed' stored in the deployment store
    const status = await this.findDeploymentItem('status');
    if (status === 'completed') return false;

    // Otherwise, it is time to attempt the upgrade
    return true;
  }

  async execute() {
    await this.checkExistingFsRoles();
  }
}

module.exports = CheckByobFsRole;
