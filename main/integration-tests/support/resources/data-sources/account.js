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

const Resource = require('../base/resource');
const { unregisterAccount } = require('../../complex/unregister-account');
const Buckets = require('./buckets');
const Studies = require('./studies');

class Account extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'account',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [account]');

    this.accountId = id;
    this.api = `${parent.api}/${id}`;
  }

  studies() {
    return new Studies({ clientSession: this.clientSession, parent: this });
  }

  buckets() {
    return new Buckets({ clientSession: this.clientSession, parent: this });
  }

  async cfn() {
    const api = `${this.api}/cfn`;

    return this.doCall(async () => this.axiosClient.post(api, {}));
  }

  async cleanup() {
    await unregisterAccount({ aws: this.setup.aws, id: this.id });
  }

  // ************************ Helpers methods ************************
}

module.exports = Account;
