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

class Transformer {
  constructor(users, tableReport) {
    this.users = users;
    this.tableReport = tableReport;
  }

  findUid({ ns, username }) {
    return this.users.findUid({ ns, username });
  }

  // An item is the raw Item object returned by DynamoDB which is
  // a map of AttributeValues.
  // For more information about AttributeValues, see
  // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
  //
  // This method transforms the item from the old format to the new format
  transform(item) {
    const props = ['createdBy', 'updatedBy'];

    _.forEach(props, prop => {
      const rawValue = item[prop];
      if (!_.isObject(rawValue)) return;
      const value = parseAttributeValue(rawValue);
      const uid = this.findUid(value);
      if (_.isUndefined(uid)) {
        const valueStr = JSON.stringify(value);
        item[prop] = toStringAttributeValue(valueStr);
        this.tableReport.addUnmatchedItem(item, `No uid match was found for ${valueStr}`);
      } else {
        item[prop] = toStringAttributeValue(uid);
      }
    });

    // Remove 'unameWithNs' if it exists, the old DbUserApiKeys table used it but
    // the new one does not
    delete item.unameWithNs;
  }
}

module.exports = Transformer;
