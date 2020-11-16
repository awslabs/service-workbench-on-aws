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

const { convertValue, statuses } = require('../helpers/transforms');

// Add uid prop using username prop and 'internal' as ns
const addUid = (uidLookup, item, logger) => {
  const rawValue = item.username;
  if (_.isUndefined(rawValue)) {
    logger.log({ value: rawValue, status: statuses.noUsernameFound });
    return;
  }

  const attribute = {
    M: {
      ns: { S: 'internal' },
      username: item.username,
    },
  };
  item.uid = convertValue(uidLookup, attribute, logger);
};

module.exports = [addUid];
