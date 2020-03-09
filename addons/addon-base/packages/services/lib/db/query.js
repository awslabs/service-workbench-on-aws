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

// To handle scan operation using DocumentClient
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#query-property
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html
// NOTE: The following properties are legacy and should not be used:
//  - AttributesToGet
//  - AttributeUpdates
//  - ConditionalOperator
//  - Expected
//  - ScanFilter
//  - KeyConditions
//  - QueryFilter

class DbQuery {
  constructor(log = console, client) {
    this.log = log;
    this.client = client;
    this.sortKeyName = undefined;
    this.params = {
      // ReturnConsumedCapacity: 'INDEXES',
    };
  }

  // same as TableName
  table(name) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbQuery.table("${name}" <== must be a string and can not be empty).`);
    this.params.TableName = name;
    return this;
  }

  // same as IndexName
  index(name) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbQuery.index("${name}" <== must be a string and can not be empty).`);
    this.params.IndexName = name;
    return this;
  }

  // can be either props(key, value) or props({ key1: value1, key2: value2, ...})
  props(...args) {
    if (args.length > 1) this.params[args[0]] = args[1];
    else Object.assign(this.params, ...args);
    return this;
  }

  // helps with setting up KeyConditionExpression
  // this is for the partition key only.  If you also need to specify sort key, then use sortKey() then .eq(), .lt() or .gt(). However,
  // if you use .condition() for the sort key expression, you will need to use values() and possibly names()
  key(name, value) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbQuery.key("${name}" <== must be a string and can not be empty).`);

    const expression = `#${name} = :${name}`;
    this._setCondition(expression);
    this.names({ [`#${name}`]: name });
    this.values({ [`:${name}`]: value });

    return this;
  }

  sortKey(name) {
    this.sortKeyName = name;
    this.names({ [`#${name}`]: name });

    return this;
  }

  // helps with setting up KeyConditionExpression
  // this is for the sort key only. It results in an equal expression using the sort key  "#<k> = :<k>". You only want to supply the value of the
  // sort key here since we assume you called .sortKey(name) before calling this one
  eq(value) {
    if (!this.sortKeyName)
      throw new Error('You tried to call DbQuery.eq(), however, you must call DbQuery.sortKey() first.');
    return this._internalExpression('=', value);
  }

  // helps with setting up KeyConditionExpression
  // this is for the sort key only. It results in an less than expression using the sort key  "#<k> < :<k>". You only want to supply the value of the
  // sort key here since we assume you called .sortKey(name) before calling this one
  lt(value) {
    if (!this.sortKeyName)
      throw new Error('You tried to call DbQuery.lt(), however, you must call DbQuery.sortKey() first.');
    return this._internalExpression('<', value);
  }

  // helps with setting up KeyConditionExpression
  // this is for the sort key only. It results in an less than or equal expression using the sort key  "#<k> <= :<k>". You only want to supply the value of the
  // sort key here since we assume you called .sortKey(name) before calling this one
  lte(value) {
    if (!this.sortKeyName)
      throw new Error('You tried to call DbQuery.lte(), however, you must call DbQuery.sortKey() first.');
    return this._internalExpression('<=', value);
  }

  // helps with setting up KeyConditionExpression
  // this is for the sort key only. It results in greater than  expression using the sort key  "#<k> > :<k>". You only want to supply the value of the
  // sort key here since we assume you called .sortKey(name) before calling this one
  gt(value) {
    if (!this.sortKeyName)
      throw new Error('You tried to call DbQuery.gt(), however, you must call DbQuery.sortKey() first.');
    return this._internalExpression('>', value);
  }

  // helps with setting up KeyConditionExpression
  // this is for the sort key only. It results in greater than or equal expression using the sort key  "#<k> >= :<k>". You only want to supply the value of the
  // sort key here since we assume you called .sortKey(name) before calling this one
  gte(value) {
    if (!this.sortKeyName)
      throw new Error('You tried to call DbQuery.gte(), however, you must call DbQuery.sortKey() first.');
    return this._internalExpression('>=', value);
  }

  // helps with setting up KeyConditionExpression
  // this is for the sort key only. It results in the between expression using the sort key  "#<k> BETWEEN :<v1> AND :<v2>". You only want to supply
  // the two between values for the sort key here since we assume you called .sortKey(name) before calling this one
  between(value1, value2) {
    if (!this.sortKeyName)
      throw new Error('You tried to call DbQuery.between(), however, you must call DbQuery.sortKey() first.');

    const expression = `#${this.sortKeyName} BETWEEN :${this.sortKeyName}1 AND :${this.sortKeyName}2`;
    this._setCondition(expression);
    this.values({
      [`:${this.sortKeyName}1`]: value1,
      [`:${this.sortKeyName}2`]: value2,
    });
    return this;
  }

  // helps with setting up KeyConditionExpression
  // this is for the sort key only. It results begins_with expression using the sort key  "begins_with( #<k> ,:<k> )". You only want to supply the value of the
  // sort key here since we assume you called .sortKey(name) before calling this one
  begins(value) {
    if (!this.sortKeyName)
      throw new Error('You tried to call DbQuery.begins(), however, you must call DbQuery.sortKey() first.');

    const expression = `begins_with ( #${this.sortKeyName}, :${this.sortKeyName} )`;
    this._setCondition(expression);
    this.values({ [`:${this.sortKeyName}`]: value });

    return this;
  }

  _internalExpression(expr, value) {
    const expression = `#${this.sortKeyName} ${expr} :${this.sortKeyName}`;
    this._setCondition(expression);
    this.values({ [`:${this.sortKeyName}`]: value });

    return this;
  }

  _setCondition(expression) {
    if (this.params.KeyConditionExpression)
      this.params.KeyConditionExpression = `${this.params.KeyConditionExpression} AND ${expression}`;
    else this.params.KeyConditionExpression = expression;
  }

  // same as ExclusiveStartKey
  start(key) {
    if (!key) delete this.params.ExclusiveStartKey;
    else this.params.ExclusiveStartKey = key;

    return this;
  }

  // same as FilterExpression
  filter(str) {
    if (this.params.FilterExpression) this.params.FilterExpression = `${this.params.FilterExpression} ${str}`;
    else this.params.FilterExpression = str;
    return this;
  }

  // same as ConsistentRead = true
  strong() {
    this.params.ConsistentRead = true;
    return this;
  }

  // same as ExpressionAttributeNames
  names(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbQuery.names("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeNames = {
      ...this.params.ExpressionAttributeNames,
      ...obj,
    };
    return this;
  }

  // same as ExpressionAttributeValues
  values(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbQuery.values("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeValues = {
      ...this.params.ExpressionAttributeValues,
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
      expr.forEach(key => {
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
    } else throw new Error(`DbQuery.projection("${expr}" <== must be a string or an array).`);

    return this;
  }

  // same as Select: ALL_ATTRIBUTES | ALL_PROJECTED_ATTRIBUTES | SPECIFIC_ATTRIBUTES | COUNT
  select(str) {
    const upper = str.toUpperCase();
    const allowed = ['ALL_ATTRIBUTES', 'ALL_PROJECTED_ATTRIBUTES', 'SPECIFIC_ATTRIBUTES', 'COUNT'];
    if (!allowed.includes(upper))
      throw new Error(`DbQuery.select("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.Select = upper;
    return this;
  }

  // same as Limit
  limit(num) {
    this.params.Limit = num;
    return this;
  }

  // same as ScanIndexForward
  forward(yesOrNo = true) {
    this.params.ScanIndexForward = yesOrNo;
    return this;
  }

  // same as ReturnConsumedCapacity
  capacity(str = '') {
    const upper = str.toUpperCase();
    const allowed = ['INDEXES', 'TOTAL', 'NONE'];
    if (!allowed.includes(upper))
      throw new Error(`DbQuery.capacity("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.ReturnConsumedCapacity = upper;
    return this;
  }

  async query() {
    let count = 0;
    let result = [];

    const done = () => {
      const limit = this.params.Limit;
      if (this.params.ExclusiveStartKey === undefined) return true;
      if (limit === undefined) return false;
      return limit <= count;
    };

    // An example of an output of one "this.client.query()" call
    // {
    //   "Items": [
    //       {
    //           "firstName": "Alan",
    //           "lastName": "Turing",
    //           "username": "alan"
    //       }
    //   ],
    //   "Count": 1,
    //   "ScannedCount": 1,
    //   "LastEvaluatedKey": {
    //       "username": "alan"
    //   }
    // }

    do {
      const data = await this.client.query(this.params).promise(); // eslint-disable-line no-await-in-loop

      this.params.ExclusiveStartKey = data.LastEvaluatedKey;
      count += data.Count;
      if (data.Count > 0) {
        result = _.concat(result, unmarshal(data.Items));
      }
    } while (!done());

    return result;
  }
}

module.exports = DbQuery;
