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

const TableError = require('./table-error');

class Scan {
  constructor(tableName, dynamoDbApi) {
    this.tableName = tableName;
    this.api = dynamoDbApi;
    this.reachedEnd = false;
    this.params = {
      TableName: tableName,
      ReturnConsumedCapacity: 'TOTAL',
    };
  }

  // Returns { 'Items' } up to given limit or less per invocation, this function should be called
  // repeatedly to get all the items. If undefined is returned, it means that there are no more
  // items. The shape of the 'Items' is exactly the same as the one described here
  // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#scan-property
  async next(limit = 25) {
    if (this.reachedEnd) return undefined;

    try {
      const data = await this.api.scan({ ...this.params, Limit: limit }).promise();
      const empty = _.get(data, 'Count', 0) === 0;

      this.params.ExclusiveStartKey = data.LastEvaluatedKey;
      if (_.isUndefined(data.LastEvaluatedKey) || empty) {
        this.reachedEnd = true;
      }

      return empty ? undefined : data;
    } catch (error) {
      throw new TableError(this.tableName).operation('scan').cause(error);
    }
  }

  // Returns all 'Items', this is done by running 'next()' until there are no more Items to return
  async all() {
    const items = [];
    let capacityUnits = 0;
    try {
      do {
        const data = await this.next();
        if (_.isUndefined(data)) break;

        items.push(...data.Items);
        capacityUnits += _.get(data, 'ConsumedCapacity.CapacityUnits', 0);
      } while (true); // eslint-disable-line no-constant-condition

      return {
        Items: items,
        ConsumedCapacity: {
          CapacityUnits: capacityUnits,
        },
      };
    } catch (error) {
      throw new TableError(this.tableName).operation('scan').cause(error);
    }
  }
}

module.exports = Scan;
