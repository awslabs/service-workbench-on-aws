/* eslint-disable no-shadow */
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

const CollectionResource = require('../../base/collection-resource');
const Configuration = require('./configuration');

class Configurations extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'configurations',
      childType: 'configuration',
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [configuration]');

    this.api = `${parent.api}/configurations`;
  }

  // Because WorkspaceTypes is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling workspaceType(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.workspaceTypes.workspace(<id>)
  configuration(id) {
    return new Configuration({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use get() method on this resource operations helper.
  defaults(configuration = {}) {
    const id = configuration.id || this.setup.gen.string({ prefix: 'configuration-type-test' });
    return {
      id,
      name: id,
      desc: this.setup.gen.description(),
      allowRoleIds: ['admin'],
      // Matches the template parameters of the cloud formation template of the service
      // catalog product referenced by the 'defaultProductId' setting.
      params: [
        { key: 'Namespace', value: 'int-test' },
        { key: 'AmiId', value: 'ami-0ff8a91507f77f867' },
        { key: 'InstanceType', value: 't3.xlarge' },
        { key: 'KeyName', value: 'fake-key-name' },
        { key: 'AccessFromCIDRBlock', value: '0.0.0.0/32' },
        { key: 'S3Mounts', value: '{}' },
        { key: 'IamPolicyDocument', value: '{}' },
        { key: 'VPC', value: 'vpc-fffff' },
        { key: 'Subnet', value: 'subnet-ffffff' },
        { key: 'EnvironmentInstanceFiles', value: 's3://xxx-xxx-xxx-123' },
        { key: 'EncryptionKeyArn', value: 'arn:aws:kms:us-east-1:1234567key/f4cbf1b2-9ee0-4bcb-9067-c82a9124e5ef' },
      ],
      ...configuration,
    };
  }

  // ************************ Helpers methods ************************
  async getAll() {
    return this.get({ include: 'all' });
  }
}

module.exports = Configurations;
