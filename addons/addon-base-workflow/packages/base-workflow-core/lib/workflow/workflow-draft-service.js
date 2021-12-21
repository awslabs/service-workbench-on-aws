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

/* eslint-disable no-await-in-loop */
const _ = require('lodash');
const slugify = require('slugify');
const Service = require('@aws-ee/base-services-container/lib/service');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

// const { ensureAdmin } = require('../authorization-assertions/assertions');
const inputSchema = require('../schema/workflow');

const settingKeys = {
  tableName: 'dbWorkflowDrafts',
};

class WorkflowDraftService extends Service {
  constructor() {
    super();
    this.dependency([
      'jsonSchemaValidationService',
      'workflowTemplateService',
      'workflowService',
      'stepTemplateService',
      'auditWriterService',
      'dbService',
    ]);
  }

  async init() {
    await super.init();
    this.tableName = this.settings.get(settingKeys.tableName);
  }

  async createDraft(
    requestContext,
    { isNewWorkflow = true, workflowId: workflowIdRaw, workflowVer = 0, templateId, templateVer = 0 } = {},
  ) {
    const [workflowService, workflowTemplateService] = await this.service([
      'workflowService',
      'workflowTemplateService',
    ]);

    // await ensureAdmin(requestContext);
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');

    const now = new Date().toISOString();
    if (!this.isWorkFlowDraftIdValid(workflowIdRaw)) {
      throw this.boom.badRequest(
        `Workflow id "${workflowIdRaw}" is not valid. The number of characters must be between 3 and 100 and no spaces. Only alpha-numeric characters, dashes, and underscores are allowed.`,
        true,
      );
    }
    const workflowId = slugify(_.kebabCase(_.startsWith(workflowIdRaw, 'wf-') ? workflowIdRaw : `wf-${workflowIdRaw}`));
    const draftId = `${by}_${workflowId}_${workflowVer}`;
    const draft = {
      id: draftId,
      workflowId,
      workflowVer,
      uid: by,
    };

    if (isNewWorkflow) {
      if (_.isEmpty(_.trim(workflowIdRaw))) throw this.boom.badRequest('A workflow id must be provided.', true);
      const existingWorkflow = await workflowService.findVersion({ id: workflowId });
      if (existingWorkflow) throw this.boom.badRequest('A workflow with the same workflow id exists.', true);
      if (_.isEmpty(templateId)) throw this.boom.badRequest('A template id must be provided.', true);
      const template = await workflowTemplateService.mustFindVersion({ id: templateId, v: templateVer });
      const selectedSteps = _.map(template.selectedSteps, step => ({
        stepTemplateId: step.stepTemplateId,
        stepTemplateVer: step.stepTemplateVer,
        id: step.id,
        title: step.title,
        desc: step.desc,
        skippable: step.skippable,
        configs: _.cloneDeep(step.defaults || {}),
        propsOverrideOption: _.cloneDeep(step.propsOverrideOption || {}),
        configOverrideOption: _.cloneDeep(step.configOverrideOption || {}),
      }));

      draft.templateId = template.id;
      draft.templateVer = template.v;
      draft.workflow = {
        id: workflowId,
        title: template.title,
        desc: template.desc,
        v: 1,
        rev: 0,
        runSpec: _.cloneDeep(template.runSpec),
        hidden: false, // template.hidden,  TODO - figure out a way to handle this
        builtin: false, // template.builtin, TODO - figure out a way to handle this
        instanceTtl: _.isNumber(template.instanceTtl) ? template.instanceTtl : null,
        createdBy: by,
        updatedBy: by,
        updatedAt: now,
        createdAt: now,
        selectedSteps,
        stepsOrderChanged: false,
        workflowTemplateId: template.id,
        workflowTemplateVer: template.v,
      };

      draft.workflow = await workflowService.prepareWorkflow(draft.workflow);
    } else {
      // if it is not a new workflow, then we do not use the template id
      if (!_.isEmpty(templateId))
        throw this.boom.badRequest('You can not change the template id of an existing  workflow', true);
      const workflow = await workflowService.mustFindVersion({ id: workflowId, v: workflowVer });
      draft.workflow = workflow;
      // TODO: we need to check if the draft is using a different version of the template where the existing workflow is not.
      // When that is the case, we need to correctly deal with config overrides
      draft.templateId = workflow.workflowTemplateId;
      draft.templateVer = workflow.workflowTemplateVer;
    }

    const dbService = await this.service('dbService');
    const table = this.tableName;

    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_not_exists(id)') // yes we need this
          .key('id', draft.id)
          .item({ ...draft, rev: 0, createdBy: by, updatedBy: by })
          .update();
      },
      async () => {
        throw this.boom.badRequest(
          `A draft for the same workflow "${workflowId}" already exists, you can not create two drafts for the same workflow`,
          true,
        );
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'create-workflow-draft', body: result });

    return result;
  }

  isWorkFlowDraftIdValid(id) {
    // The number of characters must be between 3 and 100 and no spaces. Only alpha-numeric characters, dashes, and underscores are allowed.
    const regExp = /^[\d\w-]{3,100}$/;
    return regExp.test(id);
  }

  async updateDraft(requestContext, draft = {}) {
    const [jsonSchemaValidationService, workflowService] = await this.service([
      'jsonSchemaValidationService',
      'workflowService',
    ]);

    // await ensureAdmin(requestContext);
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');

    const workflow = draft.workflow;
    // Validate the workflow
    await jsonSchemaValidationService.ensureValid(
      _.omit(workflow, ['rev', 'updatedBy', 'updatedAt', 'createdBy', 'createdAt']),
      inputSchema,
    );

    const originalDraft = await this.mustFindDraft({ id: draft.id });

    // Check if the owner of this draft is the same entity that is trying to update the draft
    if (originalDraft.uid !== by) throw this.boom.forbidden('You are not authorized to perform this operation', true);

    const originalWorkflow = originalDraft.workflow;
    if (workflow.id !== originalWorkflow.id || workflow.v !== originalWorkflow.v) {
      throw this.boom.badRequest('You can not change the workflow id of an existing draft', true);
    }

    const mergedWorkflow = { ...originalWorkflow, ...workflow };
    if (_.isEmpty(_.trim(mergedWorkflow.desc))) delete mergedWorkflow.desc;

    // Prepare the workflow
    const preparedWorkflow = await workflowService.prepareWorkflow(mergedWorkflow);

    const mergedDraft = _.omit({ ...originalDraft, ...draft }, ['updatedAt', 'updatedBy']);
    mergedDraft.workflow = preparedWorkflow;

    const dbService = await this.service('dbService');
    const table = this.tableName;

    const result = await runAndCatch(
      async () => {
        return dbService.helper
          .updater()
          .table(table)
          .condition('attribute_exists(id)') // yes we need this
          .key('id', mergedDraft.id)
          .rev(mergedDraft.rev)
          .item({ ...mergedDraft, updatedBy: by })
          .update();
      },
      async () => {
        throw this.boom.badRequest(
          'A change was made to the draft just before your update, your update is now out of sync, please try again',
          true,
        );
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'update-workflow-draft', body: result });

    return result;
  }

  async publishDraft(requestContext, draft = {}) {
    const [workflowService] = await this.service(['workflowService']);
    const publishResult = {};

    // First we simply update the draft, this ensures that certain constraints are checked
    const updatedDraft = await this.updateDraft(requestContext, draft);

    // TODO - loop through each step and ensure that the 'configs' are validated against the step inputManifest

    const workflow = updatedDraft.workflow;
    // we also need to remove certain fields
    delete workflow.rev;
    delete workflow.updatedAt;
    delete workflow.updatedBy;
    delete workflow.createdAt;
    delete workflow.createdBy;
    delete workflow.stepsOrderChanged;
    _.forEach(workflow.selectedSteps, step => {
      delete step.propsOverrideOption;
      delete step.configOverrideOption;
    });

    // We need to determine the version we want to create for the workflow. The solution below
    // is not perfect as it has a slight chance of failing if someone managed to start publishing another draft for the same workflow
    // at the same time.

    // We have two cases:
    // - The draft is trying to publish a workflow that never existed
    // - The draft is trying to publish a workflow that exists

    const existing = await workflowService.findVersion({ id: workflow.id });
    let newVersion = 1;

    if (existing) {
      newVersion = existing.v + 1;
    }

    workflow.v = newVersion;
    const publishedWorkflow = await workflowService.createVersion(requestContext, workflow);

    publishResult.workflow = publishedWorkflow;
    publishResult.hasErrors = false;

    await this.deleteDraft(requestContext, { id: draft.id });

    // Write audit event
    await this.audit(requestContext, { action: 'publish-workflow-draft', body: publishResult });

    return publishResult;
  }

  async deleteDraft(requestContext, { id }) {
    // await ensureAdmin(requestContext);
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const uid = _.get(requestContext, 'principalIdentifier.uid');
    const originalDraft = await this.mustFindDraft({ id });

    // Check if the owner of this draft is the same entity that is trying to delete the draft
    if (originalDraft.uid !== uid) throw this.boom.forbidden('You are not authorized to perform this operation', true);

    // Lets now remove the draft from the database
    const dbService = await this.service('dbService');
    const table = this.tableName;
    await dbService.helper
      .deleter()
      .table(table)
      .condition('attribute_exists(id)') // yes we need this
      .key('id', id)
      .delete();

    // Write audit event
    await this.audit(requestContext, { action: 'delete-workflow-draft', body: { id } });
  }

  // List all drafts for a uid
  async list(requestContext, { fields = [] } = {}) {
    const dbService = await this.service('dbService');
    const table = this.tableName;

    const uid = _.get(requestContext, 'principalIdentifier.uid');

    // The query route
    const result = await dbService.helper
      .query()
      .table(table)
      .index('ByUID')
      .key('uid', uid)
      .limit(2000)
      .projection(fields)
      .query();

    return result;
  }

  async findDraft({ id, fields = [] }) {
    const dbService = await this.service('dbService');
    const table = this.tableName;

    const result = await dbService.helper
      .getter()
      .table(table)
      .key('id', id)
      .projection(fields)
      .get();

    return result;
  }

  async mustFindDraft({ id, fields }) {
    const draft = await this.findDraft({ id, fields });
    if (!draft) throw this.boom.notFound(`The workflow draft "${id}" is not found`, true);
    return draft;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = WorkflowDraftService;
