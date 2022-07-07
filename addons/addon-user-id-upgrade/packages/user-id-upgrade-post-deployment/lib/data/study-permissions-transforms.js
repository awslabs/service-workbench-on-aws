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
const { convertValue, statuses, listValue, deleteProp } = require('../helpers/transforms');

// This function looks at the item and determines if the id starts with User:
const isUserEntry = item => {
  const rawValue = item.id;
  if (_.isUndefined(rawValue)) return false;

  const id = parseAttributeValue(rawValue);
  return _.startsWith(id, 'User:');
};

// Add uid prop using username prop. In this case, the username is a JSON.stringify {ns, username}
const addUid = (uidLookup, item, logger) => {
  const rawValue = item.principalIdentifier;
  if (_.isUndefined(rawValue) && isUserEntry(item)) {
    logger.log({ value: rawValue, status: statuses.noUidFound });
    return;
  }

  // This is the case where id is Study:
  if (_.isUndefined(rawValue) && !isUserEntry(item)) return;

  item.uid = convertValue(uidLookup, rawValue, logger);
};

// This transform function assumes that the addUid function has already inserted the uid.
// It checks if the 'id' starts with 'User:' and if so, replaces it with 'User:<uid>'
const updateId = (uidLookup, item, logger) => {
  if (!isUserEntry(item)) return;
  const rawUidValue = item.uid;
  if (_.isUndefined(rawUidValue)) {
    logger.log({ value: rawUidValue, status: statuses.noUidFound });
    return;
  }

  const rawIdValue = item.id;
  if (_.isUndefined(rawIdValue)) {
    logger.log({ value: rawIdValue, status: statuses.noUidFound });
    return;
  }

  const uid = parseAttributeValue(rawUidValue);

  item.id = toStringAttributeValue(`User:${uid}`);
};

module.exports = [
  addUid,
  updateId,
  listValue('readonlyUsers'),
  listValue('adminUsers'),
  deleteProp('principalIdentifier'),
];
