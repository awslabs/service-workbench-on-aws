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
const Index = require('./index');

class Indexes extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'indexes',
      childType: 'index',
      childIdProp: 'id',
    });

    this.api = '/api/indexes';
  }

  // Because Indexes is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling index(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.indexes.index(<id>)
  index(id) {
    return new Index({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(index = {}) {
    const indexId = index.id || this.setup.gen.string({ prefix: 'index-test' });
    return {
      description: this.setup.gen.description(),
      id: indexId,
      awsAccountId: index.awsAccountId,
      ...index,
    };
  }

  async cleanup(index) {
    /* if (index.id !== this.setup.gen.defaultIndexId()) */ await this.axiosClient.delete(`${this.api}/${index.id}`);
  }

  // ************************ Helpers methods ************************
  async mustFind(id) {
    const indexes = await this.get();
    const index = _.find(indexes, ind => ind.id === id);

    if (_.isEmpty(index)) throw new Error(`index "${id}" is not found`);
    return index;
  }
}

module.exports = Indexes;
