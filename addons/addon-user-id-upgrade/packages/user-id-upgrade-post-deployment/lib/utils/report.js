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

const prefix = require('./log-prefix');
const TableReport = require('./table-report');

class Report {
  constructor(saveFn, log) {
    this.saveFn = saveFn;
    this.log = log;
    this.tables = {};
  }

  getTableReport(tableName) {
    const report = this.tables[tableName] || new TableReport(tableName);
    this.tables[tableName] = report; // In case we created a new one

    return report;
  }

  async save() {
    try {
      const value = { tables: this.tables };
      const time = new Date().toISOString();
      await this.saveFn({ id: `report-${time}`, value: JSON.stringify(value) });
      this.log.info({ msg: prefix('Reports'), reports: value });
    } catch (error) {
      // We don't want to propagate this error
      this.log.info(prefix(`Note: encountered an error while trying to save user id upgrade report. ${error}`));
    }
  }
}

module.exports = Report;
