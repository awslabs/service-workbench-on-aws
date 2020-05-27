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
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#get-property
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html
// NOTE: The following properties are legacy and should not be used:
//  - AttributesToGet
//  - AttributeUpdates
//  - ConditionalOperator
//  - Expected

class DbGetter {
  constructor(log = console, client) {
    this.log = log;
    this.client = client;
    this.params = {
      // ReturnConsumedCapacity: 'INDEXES',
    };
  }

  table(name) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbGetter.table("${name}" <== must be a string and can not be empty).`);
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

  // must be keys([{ key1: value1, key2: value2, ... }, { keyA: valueA, keyB, valueB, ...}, ...])
  // uses batchGet() API instead of just get()
  keys(args) {
    this.params.Keys = args;
    return this;
  }

  // can be either props(key, value) or props({ key1: value1, key2: value2, ...})
  props(...args) {
    if (args.length > 1) this.params[args[0]] = args[1];
    else Object.assign(this.params, ...args);
    return this;
  }

  // same as ConsistentRead = true
  strong() {
    this.params.ConsistentRead = true;
    return this;
  }

  // same as ExpressionAttributeNames
  names(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbGetter.names("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeNames = {
      ...this.params.ExpressionAttributeNames,
      ...obj,
    };
    return this;
  }

  // same as ProjectionExpression
  projection(expr) {
    if (_.isEmpty(expr)) return this;
    if (_.isString(expr)) {
      if (this.params.ProjectionExpression)
        this.params.ProjectionExpression = `${this.params.ProjectionExpression}, ${expr}`;
      else this.params.ProjectionExpression = expr;
    } else if (_.isArray(expr)) {
      const names = {};
      const values = [];
      expr.forEach((key) => {
        names[`#${key}`] = key;
        values.push(`#${key}`);
      });
      const str = values.join(', ');
      if (this.params.ProjectionExpression)
        this.params.ProjectionExpression = `${this.params.ProjectionExpression}, ${str}`;
      else this.params.ProjectionExpression = str;
      this.params.ExpressionAttributeNames = {
        ...this.params.ExpressionAttributeNames,
        ...names,
      };
    } else throw new Error(`DbGetter.projection("${expr}" <== must be a string or an array).`);

    return this;
  }

  // same as ReturnConsumedCapacity
  capacity(str = '') {
    const upper = str.toUpperCase();
    const allowed = ['INDEXES', 'TOTAL', 'NONE'];
    if (!allowed.includes(upper))
      throw new Error(`DbGetter.capacity("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.ReturnConsumedCapacity = upper;
    return this;
  }

  async get() {
    if (this.params.Key && this.params.Keys)
      throw new Error('DbGetter <== only key() or keys() may be called, not both');

    let data;
    if (this.params.Key) data = (await this.client.get(this.params).promise()).Item;
    else if (this.params.Keys) {
      // BatchGet
      const batchParams = { RequestItems: {} };
      batchParams.RequestItems[this.params.TableName] = { ...this.params };

      if (this.params.ReturnConsumedCapacity) {
        batchParams.RequestItems.ReturnConsumedCapacity = this.params.ReturnConsumedCapacity;
        delete batchParams.RequestItems[this.params.TableName].ReturnConsumedCapacity;
      }

      data = (await this.client.batchGet(batchParams).promise()).Responses[this.params.TableName];
    }

    return unmarshal(data);
  }
}

module.exports = DbGetter;
