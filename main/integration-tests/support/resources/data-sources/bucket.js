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
const { unregisterBucket } = require('../../complex/unregister-bucket');
const Studies = require('./studies');

class Bucket extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'bucket',
      id,
      parent,
    });

    this.name = id;
    this.accountId = this.parent.accountId;
    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [bucket]');
  }

  studies() {
    return new Studies({ clientSession: this.clientSession, parent: this });
  }

  async cleanup() {
    await unregisterBucket({ aws: this.setup.aws, name: this.name, accountId: this.accountId });
  }

  // ************************ Helpers methods ************************
}

module.exports = Bucket;
