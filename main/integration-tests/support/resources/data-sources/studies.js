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
const Study = require('./study');

class Studies extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'studies',
      childType: 'study',
      parent,
    });

    this.bucketName = parent.name;
    this.accountId = parent.accountId;
    this.api = `${parent.api}/studies`;
  }

  study(id) {
    return new Study({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(study = {}) {
    const gen = this.setup.gen;
    const id = gen.string({ prefix: 'ds-study-id' }) || study.id;
    const folder = gen.string({ prefix: 'ds-study-test-folder' }) || study.folder;

    return {
      id,
      name: id,
      category: 'Organization',
      folder,
      description: this.setup.gen.description(),
      accessType: 'readwrite',
      kmsScope: 'bucket',
      ...study,
    };
  }

  // ************************ Helpers methods ************************
}

module.exports = Studies;
