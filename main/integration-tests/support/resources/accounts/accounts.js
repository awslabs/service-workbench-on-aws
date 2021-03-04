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
const CollectionResource = require('../base/collection-resource');
const Account = require('./account');

class Accounts extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'accounts',
      childType: 'account',
      childIdProp: 'id',
    });

    this.api = '/api/accounts';
  }

  account(id) {
    return new Account({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(account = {}) {
    const gen = this.setup.gen;
    return {
      accountName: gen.string({ prefix: account.name }),
      masterRoleArn: gen.string({ prefix: 'account-test' }),
      externalId: gen.string({ prefix: 'account-test' }),
      accountEmail: gen.username({ prefix: 'account-test' }),
      ...account,
    };
  }

  // ************************ Helpers methods ************************
  async mustFind(id) {
    const accounts = await this.get();
    const account = _.find(accounts, acc => acc.id === id);

    if (_.isEmpty(account)) throw new Error(`Account with accountId: "${id}" is not found`);
    return account;
  }

  provision(body) {
    return this.create(body, { api: `${this.api}/provision` });
  }
}

module.exports = Accounts;
