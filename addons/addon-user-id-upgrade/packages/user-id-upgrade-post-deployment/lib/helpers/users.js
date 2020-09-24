/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
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
const { generateId } = require('@aws-ee/base-services/lib/helpers/utils');

const { parseAttributeValue, toStringAttributeValue } = require('../utils/attribute-value');
const ErrorWithSuggestions = require('../utils/error-with-suggestions');
const { common } = require('./transforms');
const Transformer = require('./transformer');

// A class that is used to:
// - hold the rows for new users table
// - help produce a lookup map for the uid given {ns, username}
// - transform old users rows in memory
class UsersHolder {
  constructor({ usersTableName, oldUsersTableName, report }) {
    const systemObjId = JSON.stringify({ ns: 'internal', username: '_system_' });
    const systemUid = '_system_';
    // A map between user id string and user object id, example {'<uid>': { ns, username }}
    this.uidMap = {
      [systemUid]: systemObjId,
    };
    // A map between user object string and user id string, example {<json.stringify({ns, username})>: '<uid>'}
    this.objIdMap = {
      [systemObjId]: systemUid,
    };
    this.items = {}; // A list of user keyed by uid
    this.usersTableName = usersTableName;
    this.oldUsersTableName = oldUsersTableName;
    this.report = report;
  }

  // Use this function to tell the UsersHolder about the rows (userItems) belonging to the new users table.
  // This function, then, examines the row data and update its internal lookup map.
  // userItems = an array of items. An item is the raw Item object returned by DynamoDB which is
  // a map of AttributeValues. Example: item = { username: { 'S': 'root' }, ns: { 'S': 'internal' }, ... }
  // For more information about what an AttributeValue is, see
  // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
  setItems(userItems) {
    const tableName = this.usersTableName;
    const tableReport = this.report.getTableReport(tableName);
    _.forEach(userItems, item => {
      const uid = parseAttributeValue(item.uid);
      const username = parseAttributeValue(item.username);
      const ns = parseAttributeValue(item.ns);

      if (_.isUndefined(uid) || _.isUndefined(username) || _.isUndefined(ns)) {
        const itemStr = JSON.stringify(item);
        const parts = [
          `A user from table '${tableName}' is missing one or more of the follow properties: uid, username, ns`,
          `User = ${itemStr}.`,
        ];
        const suggestions = [
          `Check the table '${tableName}' and populate the missing properties for the user and then retry the post deployment.`,
        ];
        const message = parts.join('\n');
        tableReport.addFindings(item, [{ status: 'missingUidOrUsernameOrNs' }]);
        throw new ErrorWithSuggestions(message, suggestions);
      }

      const objId = JSON.stringify({ ns, username });
      this.uidMap[uid] = objId;
      this.objIdMap[objId] = uid;
      this.items[uid] = item;
    });
  }

  // Given objId (either as a json string or json object { ns, username }), find the uid
  uidLookup(objId) {
    const id = _.isObject(objId) ? JSON.stringify(objId) : objId;
    return this.objIdMap[id];
  }

  // Takes the old users items, if they have a matching new user items, they are left alone.
  // Otherwise a new user item is created (in memory) and added to the internal items list.
  // Any newly created users items are returned.
  //
  // The old user items = an array of items. An item is the raw Item object returned by DynamoDB
  // which is a map of AttributeValues.
  // Example: item = { username: { 'S': 'root' }, ns: { 'S': 'internal' }, ... }
  // For more information about what an AttributeValue is, see
  // https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
  async getNewUserItems(oldUsersItems) {
    const uncommitted = {};
    const tableName = this.oldUsersTableName;
    const tableReport = this.report.getTableReport(tableName);

    // First, add to uncommitted list if not found
    for (const item of oldUsersItems) {
      const username = parseAttributeValue(item.username);
      const ns = parseAttributeValue(item.ns);

      if (_.isUndefined(username) || _.isUndefined(ns)) {
        const itemStr = JSON.stringify(item);
        const parts = [
          `A user in table '${tableName}' is missing one or more of the follow properties: username, ns`,
          `User = ${itemStr}.`,
        ];
        const suggestions = [
          `Check the table '${tableName}' and populate the missing properties for the user and then retry the post deployment.`,
        ];
        const message = parts.join('\n');
        tableReport.addFindings(item, [{ status: 'missingUsernameOrNs' }]);
        throw new ErrorWithSuggestions(message, suggestions);
      }

      const objId = JSON.stringify({ ns, username });
      if (!this.objIdMap[objId]) {
        // There is no user uid that matches objId, we need to add this to the uncommitted list
        const uid = await generateId('u-');
        this.uidMap[uid] = objId;
        this.objIdMap[objId] = uid;
        const cloned = _.cloneDeep(item);
        cloned.uid = toStringAttributeValue(uid);
        uncommitted[uid] = cloned;
        this.items[uid] = cloned;
      }
    }

    // Second, we need to update the createdBy and updatedBy for all uncommitted items
    const transformer = new Transformer({ transforms: common, uidLookup: this.uidLookup.bind(this), tableReport });
    _.forEach(uncommitted, item => {
      transformer.transform(item);
    });

    return _.values(uncommitted);
  }
}

module.exports = UsersHolder;
