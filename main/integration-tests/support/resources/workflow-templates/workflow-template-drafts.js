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
const WorkflowTemplateDraft = require('./workflow-template-draft');
const { deleteWorkflowTemplateVersion } = require('../../complex/delete-workflow-template-version');

class WorkflowTemplateDrafts extends CollectionResource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'workflowTemplateDrafts',
      childType: 'workflowTemplateDraft',
      id,
    });

    this.api = `${parent.api}/drafts`;
  }

  draft(id) {
    return new WorkflowTemplateDraft({ clientSession: this.clientSession, id, parent: this });
  }

  // Uses draft(), this way we don't have to type workflowTemplateDraft() when we look up the resource nodes
  workflowTemplateDraft(id) {
    return this.draft(id);
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(draft = {}) {
    const templateId = draft.templateId || this.setup.gen.string({ prefix: 'wt-template-draft-test' });
    return {
      templateId,
      templateTitle: `Title ${templateId}`,
      ...draft,
    };
  }

  // ************************ Helpers methods ************************

  async find(id) {
    const drafts = await this.get();
    const draft = _.find(drafts, item => item.id === id);

    return draft;
  }

  async publish(body) {
    const api = `${this.api}/publish`;

    return this.doCall(async () => {
      const response = await this.axiosClient.post(api, body);
      const data = _.get(response, 'data.template');

      // We need to schedule a cleanup for this workflow template version, at the same time, we need to remove
      // the cleanup task for the workflow template draft (if one is created), this is because the logic on
      // the server side is to delete the draft from the database. So, if in our tests we create a draft and
      // publish it, the tests will try (as part of the cleanup process) to delete the draft, which no longer
      // exists on the server side.
      const taskId = `workflowTemplateVersion-${data.id}`;
      const taskIdForDraft = `workflowTemplateDraft-${body.id}`;

      // Remove existing cleanup task for the draft
      this.clientSession.removeCleanupTask(taskIdForDraft);

      // Add the appropriate cleanup task
      this.clientSession.addCleanupTask({
        id: taskId,
        task: async () => deleteWorkflowTemplateVersion({ aws: this.setup.aws, id: data.id, version: data.v }),
      });

      return response;
    });
  }
}

module.exports = WorkflowTemplateDrafts;
