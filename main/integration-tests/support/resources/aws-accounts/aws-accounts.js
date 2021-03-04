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
const AwsAccount = require('./aws-account');

class AwsAccounts extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'awsAccounts',
      childType: 'awsAccount',
      childIdProp: 'id',
    });

    this.api = '/api/aws-accounts';
  }

  awsAccount(id) {
    return new AwsAccount({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(awsAccount = {}) {
    const gen = this.setup.gen;
    const awsAccountId = awsAccount.id || gen.string({ prefix: awsAccount.name });
    return {
      description: gen.description(),
      id: awsAccountId,
      accountId: awsAccount.accountId,
      name: gen.string({ prefix: awsAccount.name }),
      roleArn: gen.string({ prefix: 'aws-account-test' }),
      externalId: gen.string({ prefix: 'aws-account-test' }),
      vpcId: gen.string({ prefix: 'aws-account-test' }),
      subnetId: gen.string({ prefix: 'aws-account-test' }),
      encryptionKeyArn: gen.string({ prefix: 'aws-account-test' }),
      ...awsAccount,
    };
  }

  // ************************ Helpers methods ************************
  async mustFindByAccountId(accountId) {
    const awsAccounts = await this.get();
    const awsAccount = _.find(awsAccounts, acc => acc.accountId === accountId);

    if (_.isEmpty(awsAccount)) throw new Error(`AWS Account with accountId: "${accountId}" is not found`);
    return awsAccount;
  }

  async mustFindByAwsAccountId(awsAccountId) {
    const awsAccounts = await this.get();
    const awsAccount = _.find(awsAccounts, acc => acc.id === awsAccountId);

    if (_.isEmpty(awsAccount)) throw new Error(`AWS Account with id: "${awsAccountId}" is not found`);
    return awsAccount;
  }

  provision(body) {
    return this.create(body, { api: `${this.api}/provision` });
  }
}

module.exports = AwsAccounts;
