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
const { deleteWorkflowTemplateVersion } = require('../../complex/delete-workflow-template-version');

class WorkflowTemplateVersion extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'workflowTemplateVersion',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [workflowTemplateVersion]');
    this.api = `${parent.api}/v/${id}`;
  }

  // ************************ Helpers methods ************************

  async cleanup() {
    // This is the template id, we get it by using the parent id
    const id = this.parent.id;
    const version = this.id;
    await deleteWorkflowTemplateVersion({ aws: this.setup.aws, id, version });
  }
}

module.exports = WorkflowTemplateVersion;
