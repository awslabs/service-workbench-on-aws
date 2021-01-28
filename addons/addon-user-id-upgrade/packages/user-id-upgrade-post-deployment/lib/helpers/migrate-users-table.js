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

const prefix = require('../utils/log-prefix');
const settingKeys = require('../utils/setting-keys');
const Scan = require('../utils/scan');
const UpdateItem = require('../utils/update-item');
const CompositeError = require('../utils/composite-error');
const UsersHolder = require('./users');

class MigrateUsersTable {
  constructor(upgradeUserIdService) {
    this.service = upgradeUserIdService;
    this.log = this.service.log;
    this.runWithMetric = this.service.runWithMetric.bind(this.service);
    this.api = this.service.api;
    this.report = this.service.report;
    this.deploymentId = 'tableMigration_DbUsers_mut';
  }

  // Returns an instance of the UsersHolder class
  // Attempts to migrate the users table (if not done already)
  async run() {
    const service = this.service;
    const usersTableName = this.getUsersTableName();
    const oldUsersTableName = this.getDepreciatedUsersTableName();
    const report = this.report;
    const usersItems = await this.loadUsersTable();
    const users = new UsersHolder({ usersTableName, oldUsersTableName, report });
    users.setItems(usersItems);

    // Do we have a status = 'completed' stored in the deployment store for this table
    const status = await service.findDeploymentItem(this.deploymentId);
    if (status === 'completed') {
      this.log.info(prefix('Users table migration - already migrated. Skipping'));
      return users;
    }

    try {
      this.log.info(prefix('Users table migration - started'));

      const oldUsersItems = await this.loadDepreciatedUsersTable();
      this.log.info(prefix(`Users table migration - examining ${_.size(oldUsersItems)} users`));
      const uncommittedItems = await users.getNewUserItems(oldUsersItems);
      if (!_.isEmpty(uncommittedItems)) {
        await this.updateUsers(uncommittedItems);
      } else {
        this.log.info(prefix('Users table migration - all users are accounted for, no need to update any rows'));
      }

      await service.saveDeploymentItem({ id: this.deploymentId, value: 'completed' });
      this.log.info(prefix('Users table migration - completed'));
      return users;
    } catch (error) {
      this.log.info(prefix('Users table migration - failed'));
      throw error;
    }
  }

  async updateUsers(usersItems) {
    const tableName = this.getUsersTableName();
    const keyNames = ['uid'];
    const items = usersItems;
    const updateItem = new UpdateItem(tableName, this.api, keyNames);
    const tableReporter = this.report.getTableReport(tableName);
    const compositeError = new CompositeError();
    const doWork = async item => {
      try {
        const data = await updateItem.update(item);
        tableReporter.incrementUpdatedRows(1);
        tableReporter.incrementConsumedCapacity(data);
      } catch (error) {
        compositeError.addError(error);
      }
    };

    // Now, lets do the update in batches
    const batches = _.chunk(items, 10);

    const metricTitle = `Table '${tableName}' - updating ${_.size(items)} users`;

    await this.runWithMetric(metricTitle, async () => {
      while (!_.isEmpty(batches)) {
        const batch = batches.shift();
        await Promise.all(_.map(batch, doWork));
        if (compositeError.hasErrors) throw compositeError;
      }
    });
  }

  // Returns Items that contains all the rows from the Users table
  async loadUsersTable() {
    const usersTable = this.getUsersTableName();
    const scan = new Scan(usersTable, this.api);
    const metricTitle = `Table '${usersTable}' - scanning all rows`;
    const tableReporter = this.report.getTableReport(usersTable);

    const data = await this.runWithMetric(metricTitle, () => scan.all());
    tableReporter.incrementConsumedCapacity(data);
    return _.get(data, 'Items');
  }

  async loadDepreciatedUsersTable() {
    const depreciatedUsersTable = this.getDepreciatedUsersTableName();
    const scan = new Scan(depreciatedUsersTable, this.api);
    const metricTitle = `Table '${depreciatedUsersTable}' - scanning all rows`;
    const tableReporter = this.report.getTableReport(depreciatedUsersTable);

    const data = await this.runWithMetric(metricTitle, () => scan.all());
    tableReporter.incrementConsumedCapacity(data);
    return _.get(data, 'Items');
  }

  getUsersTableName() {
    const service = this.service;
    return service.getTableName(settingKeys.users);
  }

  getDepreciatedUsersTableName() {
    const service = this.service;
    return service.getDepreciatedTableName(settingKeys.users);
  }
}

module.exports = MigrateUsersTable;
