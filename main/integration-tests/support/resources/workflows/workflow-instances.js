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
const WorkflowInstance = require('./workflow-instance');

class WorkflowInstances extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'workflowInstances',
      childType: 'workflowInstance',
      childIdProp: 'instance.id',
      parent,
    });

    this.api = `${parent.api}/instances`;
    this.version = parent.version;
    this.workflowId = parent.workflowId;
  }

  instance(id) {
    return new WorkflowInstance({ clientSession: this.clientSession, id, parent: this });
  }

  // Uses instance(), this way we don't have to type workflowInstance() when we look up the resource nodes
  workflowInstance(id) {
    return this.instance(id);
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(body = {}) {
    const meta = body.meta || {};
    const input = body.input || {};

    return {
      meta,
      input,
      ...body,
    };
  }

  async create(body = {}) {
    return super.create(body, {}, { api: `${this.parent.api}/trigger` });
  }

  // ************************ Helpers methods ************************

  async find(id) {
    const instances = await this.get();
    const instance = _.find(instances, item => item.id === id);

    return instance;
  }
}

module.exports = WorkflowInstances;
