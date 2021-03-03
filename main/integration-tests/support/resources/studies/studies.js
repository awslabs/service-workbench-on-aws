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

const CollectionResource = require('../base/collection-resource');
const Study = require('./study');

class Studies extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'studies',
      childType: 'study',
    });

    this.api = '/api/studies';
  }

  // Because Studies is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling study(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.studies.study(<id>)
  study(id) {
    return new Study({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(study = {}) {
    const id = study.id || this.setup.gen.string({ prefix: 'study-test' });
    return {
      id,
      name: id,
      category: 'My Studies',
      description: this.setup.gen.description(),
      projectId: this.setup.defaults.project.id,
      uploadLocationEnabled: true,
      ...study,
    };
  }

  // ************************ Helpers methods ************************
  async mustFind(id, category) {
    const studies = await this.get({ category });
    const study = _.find(studies, study => study.id === id);

    if (_.isEmpty(study)) throw new Error(`study "${id}" is not found`);
    return study;
  }

  async getOpenData() {
    return this.get({ category: 'Open Data' });
  }

  async getMyStudies() {
    return this.get({ category: 'My Studies' });
  }

  async getOrganization() {
    return this.get({ category: 'Organization' });
  }
}

module.exports = Studies;
