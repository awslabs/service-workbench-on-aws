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
// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#update-property
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html
// NOTE: The following properties are legacy and should not be used:
//  - AttributesToGet
//  - AttributeUpdates
//  - ConditionalOperator
//  - Expected

class DbUpdater {
  constructor(log = console, client) {
    this.log = log;
    this.client = client; // this is the DynamoDB.DocumentClient. This allows us to use the client.createSet() as needed
    this.params = {
      // ReturnConsumedCapacity: 'INDEXES',
      ReturnValues: 'ALL_NEW',
    };
    this.marked = {};
    this.createdAtState = { enabled: true, processed: false, value: '' };
    this.updatedAtState = { enabled: true, processed: false, value: '' };

    const self = this;
    this.internals = {
      set: [],
      add: [],
      remove: [],
      delete: [],
      revGiven: false,
      setConditionExpression: (expr, separator = 'AND') => {
        if (self.params.ConditionExpression)
          self.params.ConditionExpression = `${self.params.ConditionExpression} ${separator} ${expr}`;
        else self.params.ConditionExpression = expr;
      },
      toParams() {
        const updates = [];
        if (!_.isEmpty(this.set)) updates.push(`SET ${this.set.join(', ')}`);
        if (!_.isEmpty(this.add)) updates.push(`ADD ${this.add.join(', ')}`);
        if (!_.isEmpty(this.remove)) updates.push(`REMOVE ${this.remove.join(', ')}`);
        if (!_.isEmpty(this.delete)) updates.push(`DELETE ${this.delete.join(', ')}`);

        delete self.params.UpdateExpression;
        if (_.isEmpty(updates)) return self.params;
        self.params.UpdateExpression = updates.join(' ');
        return self.params;
      },
    };
  }

  table(name) {
    if (!_.isString(name) || _.isEmpty(_.trim(name)))
      throw new Error(`DbUpdater.table("${name}" <== must be a string and can not be empty).`);
    this.params.TableName = name;
    return this;
  }

  // mark the provided attribute names as being of type Set
  mark(arr = []) {
    if (this.params.UpdateExpression)
      throw new Error(
        'You tried to call DbUpdater.mark() after you called DbUpdater.update(). Call mark() before calling update().',
      );
    arr.forEach(key => {
      this.marked[key] = true;
    });
    return this;
  }

  // can be either key(key, value) or key({ key1: value1, key2: value2, ...})
  key(...args) {
    if (this.params.UpdateExpression)
      throw new Error(
        'You tried to call DbUpdater.key() after you called DbUpdater.update(). Call key() before calling update().',
      );
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

  disableCreatedAt() {
    if (this.params.UpdateExpression)
      throw new Error(
        'You tried to call DbUpdater.disableCreatedAt() after you called DbUpdater.update(). Call disableCreatedAt() before calling update().',
      );
    this.createdAtState.enabled = false;
    return this;
  }

  createdAt(str) {
    if (this.params.UpdateExpression)
      throw new Error(
        'You tried to call DbUpdater.createdAt() after you called DbUpdater.update(). Call createdAt() before calling update().',
      );
    if (!_.isDate(str) && (!_.isString(str) || _.isEmpty(_.trim(str))))
      throw new Error(`DbUpdater.createdAt("${str}" <== must be a string or Date and can not be empty).`);
    this.createdAtState.enabled = true;
    this.createdAtState.value = _.isDate(str) ? str.toISOString() : str;
    return this;
  }

  disableUpdatedAt() {
    if (this.params.UpdateExpression)
      throw new Error(
        'You tried to call DbUpdater.disableUpdatedAt() after you called DbUpdater.update(). Call disableUpdatedAt() before calling update().',
      );
    this.updatedAtState.enabled = false;
    return this;
  }

  updatedAt(str) {
    if (this.params.UpdateExpression)
      throw new Error(
        'You tried to call DbUpdater.updatedAt() after you called DbUpdater.update(). Call updatedAt() before calling update().',
      );
    if (!_.isDate(str) && (!_.isString(str) || _.isEmpty(_.trim(str))))
      throw new Error(`DbUpdater.updatedAt("${str}" <== must be a string or Date and can not be empty).`);
    this.updatedAtState.enabled = true;
    this.updatedAtState.value = _.isDate(str) ? str.toISOString() : str;
    return this;
  }

  // this is an additional method that helps us with using the optimistic locking technique, if you use this method,
  // you NO longer need to add the 'and #rev = :rev' and 'SET #rev = #rev + :_addOne' expressions
  rev(rev) {
    if (_.isNil(rev)) return this;
    const expression = '#rev = :rev';
    this.internals.setConditionExpression(expression);
    this.internals.revGiven = true;
    this.names({ '#rev': 'rev' });
    this.values({ ':rev': rev, ':_addOne': 1 });
    this.internals.set.push('#rev = #rev + :_addOne');

    return this;
  }

  // helps with setting up UpdateExpression
  item(item) {
    if (!item) return this;

    // we loop through all the properties that are defined and add them to the
    // update expression and to the expression values and that same time detect if they are marked as sets
    const keys = Object.keys(item);
    if (keys.length === 0) return this;

    const assignments = [];
    const values = {};
    const names = {};

    keys.forEach(key => {
      const value = item[key];
      if (value === undefined) return;
      if (this.params.Key && this.params.Key.hasOwnProperty(key)) return; // eslint-disable-line no-prototype-builtins

      if (this.createdAtState.enabled && key === 'createdAt') return;
      if (this.updatedAtState.enabled && key === 'updatedAt') return;
      if (this.internals.revGiven && key === 'rev') return;

      names[`#${key}`] = key;
      assignments.push(`#${key} = :${key}`);

      if (this.marked[key] && _.isEmpty(value)) {
        values[`:${key}`] = null;
      } else if (this.marked[key]) {
        values[`:${key}`] = this.client.createSet(value, { validate: true });
      } else {
        values[`:${key}`] = value;
      }
    });

    if (assignments.length === 0) return this;

    this.internals.set.push(assignments.join(', '));

    let createdAt = this.createdAtState.value;
    if (this.createdAtState.enabled && !this.createdAtState.processed) {
      this.createdAtState.processed = true;
      createdAt = _.isEmpty(createdAt) ? new Date().toISOString() : createdAt;
      this.internals.set.push('#createdAt = if_not_exists(#createdAt, :createdAt)');
      names['#createdAt'] = 'createdAt';
      values[':createdAt'] = createdAt;
    }

    let updatedAt = this.updatedAtState.value;
    if (this.updatedAtState.enabled && !this.updatedAtState.processed) {
      this.updatedAtState.processed = true;
      updatedAt = _.isEmpty(updatedAt) ? new Date().toISOString() : updatedAt;
      this.internals.set.push('#updatedAt = :updatedAt');
      names['#updatedAt'] = 'updatedAt';
      values[':updatedAt'] = updatedAt;
    }

    this.names(names);
    this.values(values);

    return this;
  }

  // same as using UpdateExpression with the SET clause. IMPORTANT: your expression should NOT include the 'SET' keyword
  set(expression) {
    if (!_.isEmpty(expression)) this.internals.set.push(expression);
    return this;
  }

  // same as using UpdateExpression with the ADD clause. IMPORTANT: your expression should NOT include the 'ADD' keyword
  add(expression) {
    if (!_.isEmpty(expression)) this.internals.add.push(expression);
    return this;
  }

  // same as using UpdateExpression with the REMOVE clause. IMPORTANT: your expression should NOT include the 'REMOVE' keyword
  remove(expression) {
    if (!_.isEmpty(expression)) {
      if (_.isArray(expression)) this.internals.remove.push(...expression);
      else this.internals.remove.push(expression);
    }
    return this;
  }

  // same as using UpdateExpression with the DELETE clause. IMPORTANT: your expression should NOT include the 'DELETE' keyword
  delete(expression) {
    if (!_.isEmpty(expression)) this.internals.delete.push(expression);
    return this;
  }

  // same as ExpressionAttributeNames
  names(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbUpdater.names("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeNames = {
      ...this.params.ExpressionAttributeNames,
      ...obj,
    };
    return this;
  }

  // same as ExpressionAttributeValues
  values(obj = {}) {
    if (!_.isObject(obj)) throw new Error(`DbScanner.values("${obj}" <== must be an object).`);
    this.params.ExpressionAttributeValues = {
      ...this.params.ExpressionAttributeValues,
      ...obj,
    };
    return this;
  }

  // same as ConditionExpression
  condition(str, separator = 'AND') {
    if (!_.isString(str) || _.isEmpty(_.trim(str)))
      throw new Error(`DbUpdater.condition("${str}" <== must be a string and can not be empty).`);
    this.internals.setConditionExpression(str, separator);
    return this;
  }

  // same as ReturnValues: NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW,
  return(str) {
    const upper = str.toUpperCase();
    const allowed = ['NONE', 'ALL_OLD', 'UPDATED_OLD', 'ALL_NEW', 'UPDATED_NEW'];
    if (!allowed.includes(upper))
      throw new Error(`DbUpdater.return("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.ReturnValues = upper;
    return this;
  }

  // same as ReturnItemCollectionMetrics
  metrics(str) {
    const upper = str.toUpperCase();
    const allowed = ['NONE', 'SIZE'];
    if (!allowed.includes(upper))
      throw new Error(`DbUpdater.metrics("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`);
    this.params.ReturnItemCollectionMetrics = upper;
    return this;
  }

  // same as ReturnConsumedCapacity
  capacity(str = '') {
    const upper = str.toUpperCase();
    const allowed = ['INDEXES', 'TOTAL', 'NONE'];
    if (!allowed.includes(upper))
      throw new Error(
        `DbUpdater.capacity("${upper}" <== is not a valid value). Only ${allowed.join(',')} are allowed.`,
      );
    this.params.ReturnConsumedCapacity = upper;
    return this;
  }

  async update() {
    const data = await this.client.update(this.internals.toParams()).promise();
    return unmarshal(data.Attributes);
  }
}

module.exports = DbUpdater;
