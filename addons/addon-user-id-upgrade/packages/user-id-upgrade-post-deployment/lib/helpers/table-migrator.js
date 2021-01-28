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

const logPrefix = require('../utils/log-prefix');
const Scan = require('../utils/scan');
const Metric = require('../utils/metric');
const CompositeError = require('../utils/composite-error');
const UpdateItem = require('../utils/update-item');
const Transformer = require('./transformer');

// Responsible for migrating data between two tables
class TableMigrator {
  constructor({ upgradeUserIdService, table, keyNames, uidLookup, transforms, batchSize }) {
    this.service = upgradeUserIdService;
    this.table = table;
    this.uidLookup = uidLookup;
    this.keyNames = keyNames;
    this.batchSize = batchSize;
    this.transforms = transforms;
    this.log = this.service.log;
    this.runWithMetric = this.service.runWithMetric.bind(this.service);
    this.metrics = this.service.metrics;
    this.api = this.service.api;
    this.report = this.service.report;
    this.info = msg => this.log.info(logPrefix(`${table} table migration - ${_.upperFirst(msg)}`));
    this.deploymentId = `tableMigration_${table}_tm`;
  }

  async run() {
    const service = this.service;
    const srcTableName = this.getDepreciatedTableName();
    const targetTableName = this.getTableName();
    const srcTableReport = this.report.getTableReport(srcTableName);
    const targetTableReport = this.report.getTableReport(targetTableName);
    const batchSize = this.batchSize;
    const transforms = this.transforms;
    const uidLookup = this.uidLookup;
    const transformer = new Transformer({ transforms, uidLookup, tableReport: srcTableReport });

    // Do we have a status = 'completed' stored in the deployment store for this table
    const status = await service.findDeploymentItem(this.deploymentId);
    if (status === 'completed') {
      this.info('already migrated. Skipping');
      return;
    }

    // Lets do the table migration
    const metric = new Metric(`Migrating ${this.table} tables`);
    const compositeError = new CompositeError();
    try {
      metric.start();
      this.info('Started');
      this.info(`Source table '${srcTableName}' - Target table '${targetTableName}'`);

      const updateItem = new UpdateItem(targetTableName, this.api, this.keyNames);
      const updateConditionProvider = this.getUpdateConditionProvider();

      // This function is a worker function, it processes one row at a time
      const doWork = async item => {
        // Lets update the item, but only if it is does not exist in the target table
        try {
          transformer.transform(item);
          const data = await updateItem.update(item, updateConditionProvider);
          targetTableReport.incrementUpdatedRows(1);
          targetTableReport.incrementConsumedCapacity(data);
        } catch (error) {
          if (error && error.code === 'ConditionalCheckFailedException') {
            targetTableReport.incrementSkippedRows(1);
            return;
          }
          compositeError.addError(error);
        }
      };

      const scan = new Scan(srcTableName, this.api);
      do {
        // Get batchSize rows from the src table
        const data = await scan.next(batchSize);
        if (_.isUndefined(data)) break;
        srcTableReport.incrementConsumedCapacity(data);

        // Update batchSize rows in parallel in the target table
        const batch = _.get(data, 'Items', []);
        await Promise.all(_.map(batch, doWork));
        if (compositeError.hasErrors) throw compositeError;
      } while (true); // eslint-disable-line no-constant-condition

      await service.saveDeploymentItem({ id: this.deploymentId, value: 'completed' });
      this.printStats('Completed');
    } catch (error) {
      this.printStats('Failed');
      throw error;
    } finally {
      metric.end();
      this.metrics.addMetric(metric);
    }
  }

  printStats(title) {
    const targetTableName = this.getTableName();
    const tableReport = this.report.getTableReport(targetTableName);
    const updatedRows = tableReport.updatedRows;
    const skippedRows = tableReport.skippedRows;

    return this.info(`${title} - updated ${updatedRows} rows, skipped ${skippedRows} rows`);
  }

  getUpdateConditionProvider() {
    // eslint-disable-next-line no-unused-vars
    return (item, names, values) => {
      const parts = [];
      _.forEach(this.keyNames, key => {
        parts.push(`attribute_not_exists(#${key})`);
        names[`#${key}`] = key;
      });
      return parts.join(' AND ');
    };
  }

  getTableName() {
    const service = this.service;
    return service.getTableName(this.table);
  }

  getDepreciatedTableName() {
    const service = this.service;
    return service.getDepreciatedTableName(this.table);
  }
}

module.exports = TableMigrator;
