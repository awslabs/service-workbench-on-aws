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

const unmarshal = require('./unmarshal');

// To handle get operation using DocumentClient
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#delete-property
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html
// NOTE: The following properties are legacy and should not be used:
//  - ConditionalOperator
//  - Expected

class DbDeleter {
  constructor(log = console, client) {
    this.log = log;
    this.client = client;
    this.params = {
      // ReturnConsumedCapacity: 'INDEXES',
    };
  }

  table(name) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbDeleter.table("${name}" <== must be a string and can not be empty).`);
    this.params.TableName = name;
    return this;
  }

  // can be either key(key, value) or key({ key1: value1, key2: value2, ...})
  key(...args) {
    if (!this.params.Key) this.params.Key = {};

    if (args.length > 1) this.params.Key[args[0]] = args[1];
    else Object.assign(this.params.Key, ...args);
    return this;
  }

  // can be either props(key, value) or props({ key1: value1, key2: value2, ...})
  props(...args) {
    if (args.length > 1) this.params[args[0]] = args[1];
    else Object.assign(this.params, ...args);
    return this;
  }

  // same as ConditionExpression
  condition(str) {
    if (this.params.ConditionExpression)
      throw new Error(`DbDeleter.condition("${str}"), you already called condition() before this call.`);
    this.params.ConditionExpression = str;
    return this;
  }

  // same as ExpressionAttributeNames
  names(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbDeleter.names("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeNames = {
      ...this.params.ExpressionAttributeNames,
      ...obj,
    };
    return this;
  }

  // same as ExpressionAttributeValues
  values(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbDeleter.values("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeValues = {
      ...this.params.ExpressionAttributeValues,
      ...obj,
    };
    return this;
  }

  // same as ReturnValues: NONE | ALL_OLD
  return(str) {
    const upper = str.toUpperCase();
    const allowed = ['NONE', 'ALL_OLD'];
    if (!allowed.includes(upper))
      throw new Error(`DbDeleter.return("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.ReturnValues = upper;
    return this;
  }

  // same as ReturnConsumedCapacity
  capacity(str = '') {
    const upper = str.toUpperCase();
    const allowed = ['INDEXES', 'TOTAL', 'NONE'];
    if (!allowed.includes(upper))
      throw new Error(
        `DbDeleter.capacity("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`,
      );
    this.params.ReturnConsumedCapacity = upper;
    return this;
  }

  // same as ReturnItemCollectionMetrics
  metrics(str) {
    const upper = str.toUpperCase();
    const allowed = ['NONE', 'SIZE'];
    if (!allowed.includes(upper))
      throw new Error(`DbDeleter.metrics("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.ReturnItemCollectionMetrics = upper;
    return this;
  }

  async delete() {
    const data = await this.client.delete(this.params).promise();
    return unmarshal(data.Item);
  }
}

module.exports = DbDeleter;
