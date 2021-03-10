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
const WorkflowVersion = require('./workflow-version');

class WorkflowVersions extends CollectionResource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'workflowVersions',
      childType: 'workflowVersion',
      childIdProp: 'v',
      id,
    });

    this.api = `${parent.api}/${id}`;
  }

  version(v) {
    return new WorkflowVersion({ clientSession: this.clientSession, id: v, parent: this });
  }

  // Uses version(), this way we don't have to type workflowVersion() when we look up the resource nodes
  workflowVersion(v) {
    return this.version(v);
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(workflow = {}) {
    const id = this.id;
    const workflowTemplateId = workflow.workflowTemplateId || this.setup.defaults.workflowTemplateId;
    return {
      id,
      title: `Title ${id}`,
      v: 1,
      selectedSteps: [],
      desc: this.setup.gen.description,
      workflowTemplateId,
      workflowTemplateVer: 1,
      ...workflow,
    };
  }

  async create(body = {}) {
    return super.create({ id: this.id, ...body }, {}, { api: `${this.api}/v` });
  }

  async latest() {
    return this.get({}, { api: `${this.api}/latest` });
  }

  // ************************ Helpers methods ************************

  async find(id) {
    const workflows = await this.get();
    const workflow = _.find(workflows, item => item.id === id);

    return workflow;
  }
}

module.exports = WorkflowVersions;
