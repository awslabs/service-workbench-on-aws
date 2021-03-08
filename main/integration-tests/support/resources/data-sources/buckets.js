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
const Bucket = require('./bucket');

class Buckets extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'buckets',
      childType: 'bucket',
      childIdProp: 'name',
      parent,
    });

    this.accountId = parent.id;
    this.api = `${parent.api}/buckets`;
  }

  bucket(name) {
    return new Bucket({ clientSession: this.clientSession, id: name, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(bucket = {}) {
    const gen = this.setup.gen;
    const accountId = this.accountId;
    const region = 'us-east-1' || bucket.region;

    return {
      accountId,
      name: gen.string({ prefix: 'ds-bucket-test' }),
      region,
      awsPartition: 'aws',
      kmsArn: `arn:aws:kms:${region}:${accountId}:key/${gen.string()}-key`,
      access: 'roles',
      sse: 'kms',
      ...bucket,
    };
  }

  // ************************ Helpers methods ************************
  async mustFind(name) {
    const buckets = await this.get();
    const bucket = _.find(buckets, item => item.name === name);

    if (_.isEmpty(bucket)) throw new Error(`Data source bucket with bucket name "${name}" is not found`);
    return bucket;
  }
}

module.exports = Buckets;
