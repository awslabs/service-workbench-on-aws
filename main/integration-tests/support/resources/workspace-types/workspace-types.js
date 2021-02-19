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
const WorkspaceType = require('./workspace-type');

class WorkspaceTypes extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'workspaceTypes',
      childType: 'workspaceType',
    });

    this.api = '/api/workspace-types';
  }

  // Because WorkspaceTypes is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling workspaceType(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.workspaceTypes.workspace(<id>)
  workspaceType(id) {
    return new WorkspaceType({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use get() method on this resource operations helper.
  defaults(workspaceType = {}) {
    const id = workspaceType.id || this.setup.gen.string({ prefix: 'workspace-type-test' });
    return {
      id,
      name: id,
      desc: this.setup.gen.description(),
      status: 'not-approved',
      product: { productId: this.settings.get('defaultProductId') },
      provisioningArtifact: { id: this.settings.get('defaultProvisioningArtifactId') },
      ...workspaceType,
    };
  }

  async update(body = {}, params = {}, { api = this.api } = {}) {
    return super.update(body, params, { api: `${api}/${body.id}` });
  }

  // ************************ Helpers methods ************************
  async mustFind(id, status) {
    const workspaceTypes = await this.get({ status });
    const workspaceType = _.find(workspaceTypes, workspaceType => workspaceType.id === id);

    if (_.isEmpty(workspaceType)) throw new Error(`workspace-type "${id}" is not found`);
    return workspaceType;
  }

  async getApproved() {
    return this.get({ status: 'approved' });
  }

  async getNotApproved() {
    return this.get({ status: 'not-approved' });
  }
}

module.exports = WorkspaceTypes;
