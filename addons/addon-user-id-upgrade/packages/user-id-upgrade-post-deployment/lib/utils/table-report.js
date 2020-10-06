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

class TableReport {
  constructor(tableName) {
    this.name = tableName;
    this.updatedRows = 0;
    this.skippedRows = 0;
    this.findings = [];
    this.capacityUnits = 0;
  }

  incrementUpdatedRows(num) {
    this.updatedRows += num;
  }

  incrementSkippedRows(num) {
    this.skippedRows += num;
  }

  incrementConsumedCapacity(data) {
    this.capacityUnits += _.get(data, 'ConsumedCapacity.CapacityUnits', 0);
  }

  addFindings(item, findings) {
    this.findings.push({ row: item, findings });
  }
}

module.exports = TableReport;
