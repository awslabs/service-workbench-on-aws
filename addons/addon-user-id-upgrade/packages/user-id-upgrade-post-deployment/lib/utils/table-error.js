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

const { insertRetrySuggestion } = require('./error-utils');
const { parseAttributeValue } = require('./attribute-value');

class TableError extends Error {
  /**
   * @param tableName The table name
   */
  constructor(tableName) {
    super();
    this.tableName = tableName;
    this.parsedKey = '';
    this.compositeError = true;
  }

  cause(root) {
    this.root = root;
    this.code = root && root.code;
    return this;
  }

  // Must be one of the followings:
  // scan, get, update, delete, describe
  operation(operation) {
    this.operation = operation;
    return this;
  }

  // 'key' is expected to be an object that maps directly to DynamoDb 'Key' parameter.
  // Each property name in the 'key' object is the name. The value is expected to be
  // an AttributeValue object.
  // see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
  //
  // Example: { "<hashKey>": { "S": "123" }, "<sortKey": { "S" : "567" }
  key(key) {
    this.key = key;
    this.parsedKey = this.parseKey();
    return this;
  }

  parseKey() {
    const entries = [];
    try {
      _.forEach(this.key, (value, key) => {
        // The 'value' is expected to be an AttributeValue object
        if (!_.isObject(value)) {
          entries.push(`${key} = '${value}'`);
          return;
        }

        const converted = parseAttributeValue(value);
        if (_.isString(converted)) {
          entries.push(`${key} = '${converted}'`);
          return;
        }
        entries.push(`${key} = '${JSON.stringify(converted)}'`);
      });
    } catch (error) {
      // ignore error
    }

    return entries.join(', ');
  }

  get message() {
    const parts = [];
    const hasRoot = !!this.root;
    const hasComposite = hasRoot && this.root.compositeError;
    const hasSuggestions = hasRoot && this.root.hasSuggestions;

    parts.push(`Table '${this.tableName}'`);
    if (!_.isEmpty(this.operation)) parts.push(`Action '${_.startCase(this.operation)}'`);
    if (!_.isEmpty(this.parsedKey)) parts.push(`Key [${this.parsedKey}]`);
    if (hasRoot && !hasComposite && !hasSuggestions) parts.push(`Error: ${this.root.message || 'Unknown error'}`);
    if (hasRoot && !hasComposite && hasSuggestions)
      parts.push(`Error: ${this.root.messageWithoutSuggestions || 'Unknown error'}`);

    if (hasRoot && hasComposite) parts.push('One or more errors occurred');

    return parts.join(' - ');
  }

  getMessages() {
    const messages = [this.message];

    if (this.root && this.root.compositeError) {
      messages.push(...this.root.getMessages());
    }

    if (this.root && this.root.hasSuggestions) {
      messages.push(this.root.messageWithoutSuggestions);
    }

    return messages;
  }

  getSuggestions() {
    const result = [];
    const tableName = this.tableName;
    const code = _.get(this.root, 'code');

    switch (code) {
      case 'AccessDeniedException':
        result.push(`Check if the table '${tableName}' exists.`);
        result.push(`Check if post deployment lambda has permission to access the table '${tableName}'.`);
        break;
      default:
    }

    if (this.root && this.root.compositeError) {
      result.push(...this.root.getSuggestions());
    }
    if (this.root && this.root.hasSuggestions) {
      result.push(...this.root.suggestions);
    }

    return insertRetrySuggestion(_.uniq(result));
  }

  getRoots() {
    const roots = [];
    if (this.root && this.root.compositeError) {
      roots.push(...this.root.getRoots());
    } else if (this.root) {
      roots.push(this.root);
    }

    return roots;
  }
}

module.exports = TableError;
