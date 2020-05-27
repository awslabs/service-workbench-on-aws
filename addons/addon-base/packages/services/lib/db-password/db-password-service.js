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
const crypto = require('crypto');
const uuid = require('uuid/v4');
const Service = require('@aws-ee/base-services-container/lib/service');
const { ensureCurrentUserOrAdmin } = require('../authorization/assertions');

const settingKeys = {
  tableName: 'dbTablePasswords',
};

class DbPasswordService extends Service {
  constructor() {
    super();
    this.dependency('dbService');
  }

  async passwordMatchesPasswordPolicy(password) {
    // TODO: Support more comprehensive and configurable password policy
    return password && _.isString(password) && password.length >= 4;
  }

  async assertValidPassword(password) {
    const isValidPassword = await this.passwordMatchesPasswordPolicy(password);
    if (!isValidPassword) {
      throw this.boom.badRequest(
        'Can not save password. Invalid password specified. Please specify a valid password with at least 4 characters',
        true,
      );
    }
  }

  async savePassword(requestContext, { username, password }) {
    // Assert that the password is valid (i.e., it matches password policy)
    await this.assertValidPassword(password);

    // Allow only current user or admin to update (or create) the user's password
    await ensureCurrentUserOrAdmin(requestContext, username);

    const isValidPassword = await this.passwordMatchesPasswordPolicy(password);
    if (!isValidPassword) {
      throw this.boom.badRequest(
        'Can not save password. ' +
          'Invalid password specified. Please specify a valid password with at least 4 characters',
        true,
      );
    }

    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    const salt = uuid();
    const hashed = this.hash({ password, salt });

    await dbService.helper.updater().table(table).key({ username }).item({ hashed, salt }).update();
  }

  async exists({ username, password }) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    const item = await dbService.helper.getter().table(table).key('username', username).get();

    if (item === undefined) return false;
    const hashed = this.hash({ password, salt: item.salt });

    return hashed === item.hashed && username === item.username;
  }

  hash({ password, salt }) {
    const hash = crypto.createHash('sha256');
    hash.update(`${password}${salt}`);
    return hash.digest('hex');
  }
}

module.exports = DbPasswordService;
