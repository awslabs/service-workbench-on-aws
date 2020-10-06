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

const TableError = require('./table-error');

class UpdateItem {
  constructor(tableName, dynamoDbApi, keyNames) {
    this.tableName = tableName;
    this.api = dynamoDbApi;
    this.keyNames = keyNames;
    this.params = {
      TableName: tableName,
    };
  }

  async update(item, conditionProvider = () => {}) {
    const keyNames = this.keyNames;
    const tableName = this.tableName;
    const keys = {};
    const names = [];
    const values = [];
    const assignments = [];

    _.forEach(item, (value, key) => {
      if (keyNames.includes(key)) {
        keys[key] = value;
        return;
      }
      names[`#${key}`] = key;
      values[`:${key}`] = value;
      assignments.push(`#${key} = :${key}`);
    });

    try {
      const params = {
        TableName: tableName,
        Key: keys,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
        ReturnConsumedCapacity: 'TOTAL',
      };

      if (!_.isEmpty(assignments)) {
        params.UpdateExpression = `SET ${assignments.join(', ')}`;
      }

      const condition = conditionProvider(item, names, values);
      if (!_.isEmpty(condition)) {
        params.ConditionExpression = condition;
      }
      const output = await this.api.updateItem(params).promise();

      return output;
    } catch (error) {
      throw new TableError(tableName)
        .operation('update')
        .key(keys)
        .cause(error);
    }
  }
}

module.exports = UpdateItem;
