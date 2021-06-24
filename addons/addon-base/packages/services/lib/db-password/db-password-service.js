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
const { runAndCatch } = require('../helpers/utils');
const { isSystem } = require('../authorization/authorization-utils');

const settingKeys = {
  tableName: 'dbPasswords',
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

  async saveRootPassword(requestContext, { password, uid }) {
    const username = this.settings.get('rootUserName');
    if (!isSystem(requestContext)) {
      throw this.boom.badRequest("'root' password can only be changed by 'system' user", true);
    }
    await this.savePasswordHelper(username, password, uid);
  }

  async savePassword(requestContext, { username, password, uid }) {
    // Allow only current user or admin to update (or create) the user's password
    await ensureCurrentUserOrAdmin(requestContext, { uid });

    // Don't allow users to change root user's password
    if (username === this.settings.get('rootUserName')) {
      throw this.boom.badRequest("'root' password can not be changed", true);
    }

    await this.savePasswordHelper(username, password, uid);
  }

  async savePasswordHelper(username, password, uid) {
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

    await dbService.helper
      .updater()
      .table(table)
      .key({ username })
      .item({ hashed, salt, uid })
      .update();
  }

  async deletePassword(requestContext, { username, uid }) {
    // Allow only current user or admin to delete the user's password
    await ensureCurrentUserOrAdmin(requestContext, { uid });

    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    await runAndCatch(
      async () => {
        return dbService.helper
          .deleter()
          .table(table)
          .condition('attribute_exists(username)')
          .key({ username })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`Password for the user does not exist`, true);
      },
    );
  }

  async validatePassword({ username, password }) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    const item = await dbService.helper
      .getter()
      .table(table)
      .key('username', username)
      .get();

    if (item === undefined) return false;
    const hashed = this.hash({ password, salt: item.salt });

    return { uid: item.uid, isValid: hashed === item.hashed && username === item.username };
  }

  hash({ password, salt }) {
    const hash = crypto.createHash('sha256');
    hash.update(`${password}${salt}`);
    return hash.digest('hex');
  }
}

module.exports = DbPasswordService;
