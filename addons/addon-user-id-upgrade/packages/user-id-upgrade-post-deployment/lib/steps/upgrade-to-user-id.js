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

const prefix = require('../utils/log-prefix');
const { logError } = require('../utils/error-utils');
const { toStringAttributeValue } = require('../utils/attribute-value');
const GetItem = require('../utils/get-item');
const Metrics = require('../utils/metrics');
const Metric = require('../utils/metric');
const Report = require('../utils/report');
const settingKeys = require('../utils/setting-keys');
const MigrateUsersTable = require('../helpers/migrate-users-table');
const CompositeError = require('../utils/composite-error');
const TableMigrator = require('../helpers/table-migrator');
const tablesFn = require('../data/tables');

class UpgradeToUserId extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'deploymentStoreService']);
  }

  async init() {
    await super.init();
    const aws = await this.service('aws');
    this.api = new aws.sdk.DynamoDB({ apiVersion: '2012-08-10' });
    this.metrics = new Metrics(this.saveDeploymentItem.bind(this), this.log);
    this.report = new Report(this.saveDeploymentItem.bind(this), this.log);
  }

  async execute() {
    this.metrics.start();
    let shouldUpgrade = true;
    try {
      this.log.info(prefix('Started'));
      shouldUpgrade = await this.shouldUpgrade();
      if (!shouldUpgrade) {
        this.log.info(prefix('user id upgrade is not needed. Skipping.'));
        return;
      }

      // Do the users tables migration first (if needed)
      const migrateUsersTable = new MigrateUsersTable(this);
      const usersHolder = await migrateUsersTable.run();
      const uidLookup = usersHolder.uidLookup.bind(usersHolder);

      // Do the rest of the tables
      const compositeError = new CompositeError();
      // This function is a worker function, it uses the table migrator object
      // to do the migration of a table.
      const doWork = async item => {
        try {
          const migrator = new TableMigrator({
            upgradeUserIdService: this,
            uidLookup,
            // table is the canonical table name. Using the canonical name, we can deduce
            // the name of the source and target tables.
            table: item.name,
            keyNames: item.keys, // the key names for the target table
            transforms: item.transforms, // a list of functions that transforms a row
            batchSize: item.batchSize || 10, // default is 10 rows at a time
          });
          await migrator.run();
        } catch (error) {
          compositeError.addError(error);
        }
      };

      const tables = tablesFn();
      this.log.info(prefix(`About to migrate the remaining ${_.size(tables)} tables`));

      // Now, lets do them in batches (5 tables at a time)
      const batches = _.chunk(tables, 5);
      while (!_.isEmpty(batches)) {
        const batch = batches.shift();
        await Promise.all(_.map(batch, doWork));
        if (compositeError.hasErrors) throw compositeError;
      }

      await this.saveDeploymentItem({ id: 'status', value: 'completed' });
      this.log.info(prefix('Completed'));
    } catch (error) {
      this.log.info(prefix('Failed'));
      logError(error, this.log);
      throw new Error('Upgrading to user id step has errors. See the previous log message for more details.');
    } finally {
      this.metrics.end();
      // We don't want to save the metrics in the database if the upgrade is skipped
      if (shouldUpgrade) {
        await this.metrics.save();
        await this.report.save();
      }
      const time = this.metrics.toMilliseconds();
      this.log.info({ msg: prefix(`took ${time} ms`), runTime: time });
    }
  }

  // Determines if the upgrade should be attempted. The logic is as follows:
  // - Check if the old users table has an entry for 'root', if it does NOT, then
  //   it means that this is a new installation and there is no need to do the upgrade.
  // - Check if the deployment store has 'completed' for user-id-upgrade-v1
  //   if so, then there is no need to do the upgrade.
  // - If none of the above, then we need to do the upgrade.
  async shouldUpgrade() {
    // Do we have a root user in the depreciated DbUsers table
    const depreciatedUsersTable = this.getDepreciatedTableName(settingKeys.users);
    const tableReporter = this.report.getTableReport(depreciatedUsersTable);
    const getItem = new GetItem(depreciatedUsersTable, this.api);
    const key = {
      username: toStringAttributeValue('root'),
      ns: toStringAttributeValue('internal'),
    };
    const data = await getItem.get(key);

    tableReporter.incrementConsumedCapacity(data);
    const empty = _.isEmpty(_.get(data, 'Item'));
    if (empty) return false; // No need to do the upgrade

    // Do we have a status = 'completed' stored in the deployment store
    const status = await this.findDeploymentItem('status');
    if (status === 'completed') return false;

    // Otherwise, it is time to attempt the upgrade
    return true;
  }

  async findDeploymentItem(id) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    const result = await deploymentStore.find({ type: 'user-id-upgrade-v1', id });

    return _.get(result, 'value');
  }

  async saveDeploymentItem({ id, value }) {
    const [deploymentStore] = await this.service(['deploymentStoreService']);
    return deploymentStore.createOrUpdate({ type: 'user-id-upgrade-v1', id, value });
  }

  async runWithMetric(metricTitle, fn) {
    const metric = new Metric(metricTitle);
    this.log.info(prefix(metricTitle));
    try {
      metric.start();
      const result = await fn();
      return result;
    } finally {
      metric.end();
      this.metrics.addMetric(metric);
    }
  }

  // Given the name (the settings key) of a table, get its depreciated name
  getDepreciatedTableName(name) {
    return this.settings.get(`db${name}Depreciated`);
  }

  // Given the name (the settings key) of a table, get its name
  getTableName(name) {
    return this.settings.get(`db${name}`);
  }
}

module.exports = UpgradeToUserId;
