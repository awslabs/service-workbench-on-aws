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
const { deleteWorkflowInstance } = require('../../complex/delete-workflow-instance');

class WorkflowVersion extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'workflowInstance',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [workflowInstance]');
    this.api = `${parent.api}/${id}`;

    this.instanceId = id;
    this.version = parent.version;
    this.workflowId = parent.workflowId;
  }

  // ************************ Helpers methods ************************

  async cleanup(resource) {
    const instanceId = this.instanceId;
    const version = this.version;
    const workflowId = this.workflowId;
    const executionArn = _.get(resource, 'executionArn');
    await deleteWorkflowInstance({ aws: this.setup.aws, instanceId, version, workflowId, executionArn });
  }
}

module.exports = WorkflowVersion;
