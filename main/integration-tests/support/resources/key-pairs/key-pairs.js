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

const CollectionResource = require('../base/collection-resource');
const KeyPair = require('./key-pair');

class KeyPairs extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'keyPairs',
      childType: 'keyPair',
    });

    this.api = '/api/key-pairs';
  }

  // Because Studies is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling study(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.studies.study(<id>)
  keyPair(id) {
    return new KeyPair({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(keyPair = {}) {
    return {
      name: this.setup.gen.string({ prefix: 'test-key-pair' }),
      desc: this.setup.gen.description(),
      ...keyPair,
    };
  }

  // ************************ Helpers methods ************************
}

module.exports = KeyPairs;
