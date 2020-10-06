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
const { convertValue, statuses, deleteProp } = require('../helpers/transforms');

// Add uid prop using username prop. In this case, the username is a JSON.stringify {ns, username}
const addUid = (uidLookup, item, logger) => {
  const rawValue = item.username;
  if (_.isUndefined(rawValue)) {
    logger.log({ value: rawValue, status: statuses.noUsernameFound });
    return;
  }

  try {
    const { ns, username } = JSON.parse(parseAttributeValue(rawValue));
    const attribute = { M: { ns: toStringAttributeValue(ns), username: toStringAttributeValue(username) } };

    item.uid = convertValue(uidLookup, attribute, logger);
  } catch (error) {
    logger.log({ value: rawValue, status: statuses.incorrectFormat });
  }
};

module.exports = [addUid, deleteProp('username')];
