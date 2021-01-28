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

const { parseAttributeValue, toStringAttributeValue } = require('../utils/attribute-value');

const statuses = {
  noUidFound: 'noUidFound',
  noUsernameFound: 'noUsernameFound',
  noNsFound: 'noNsFound',
  incorrectFormat: 'incorrectFormat',
};

// Returns the converted rawValue (of an AttributeValue object) from the old user identity
// format ({ ns: {'S': '<ns'>}, username: {'S': '<username>'} }) to {'S': '<uid>'}.
// rawValue is expected to be an AttributeValue object.
const convertValue = (uidLookup, rawValue, logger) => {
  // A helper function that logs the finding and returns the value
  const result = (value, status) => {
    logger.log({ value: rawValue, status });
    return value;
  };

  if (_.isUndefined(rawValue)) return undefined;

  if (!_.isObject(rawValue)) {
    return result(rawValue, statuses.incorrectFormat);
  }
  const value = parseAttributeValue(rawValue);
  if (!_.isObject(value)) {
    return result(rawValue, statuses.incorrectFormat);
  }

  if (!_.has(value, 'ns') || !_.has(value, 'username')) {
    return result(rawValue, statuses.incorrectFormat);
  }

  const uid = uidLookup(value);
  if (_.isUndefined(uid)) {
    const valueStr = JSON.stringify(value);
    return result(toStringAttributeValue(valueStr), statuses.noUidFound);
  }
  return toStringAttributeValue(uid);
};

// Transforms the specified prop. The transformation includes
// converting the prop value (of an AttributeValue object) from the old user identity
// format ({ ns: {'S': '<ns'>}, username: {'S': '<username>'} }) to {'S': ''}.
// This functions updates the provided 'item' in place (i.e. mutates it).
const singleValue = prop => (uidLookup, item, logger) => {
  if (!_.has(item, prop)) return;
  const rawValue = item[prop];
  item[prop] = convertValue(uidLookup, rawValue, logger);
};

// Transforms the specified prop. The value of this prop is expected to be a list
// of AttributeValue objects. Example: { 'L': [ <AttributeValue>, <AttributeValue> ]}.
// For more information about AttributeValues, see
// https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
const listValue = prop => (uidLookup, item, logger) => {
  if (!_.has(item, prop)) return;
  const rawValue = item[prop];
  if (_.isUndefined(rawValue)) return;
  if (_.first(_.keys(rawValue)) !== 'L') {
    logger.log({ value: rawValue, status: statuses.incorrectFormat });
    return;
  }
  const list = _.map(rawValue.L, entry => convertValue(uidLookup, entry, logger));
  item[prop] = { L: list };
};

// eslint-disable-next-line no-unused-vars
const deleteProp = prop => (uidLookup, item, logger) => {
  delete item[prop];
};

const common = [singleValue('createdBy'), singleValue('updatedBy')];

module.exports = { singleValue, listValue, deleteProp, convertValue, statuses, common };
