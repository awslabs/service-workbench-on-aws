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
const { ensureAdmin } = require('@aws-ee/base-services/lib/authorization/assertions');
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const inputSchema = require('../schema/workflow-template');

const settingKeys = {
  tableName: 'dbWorkflowTemplateDrafts',
};

class WorkflowTemplateDraftService extends Service {
  constructor() {
    super();
    this.dependency([
      'jsonSchemaValidationService',
      'workflowTemplateService',
      'stepTemplateService',
      'dbService',
      'auditWriterService',
    ]);
  }

  async init() {
    await super.init();
    this.tableName = this.settings.get(settingKeys.tableName);
  }

  async createDraft(
    requestContext,
    { isNewTemplate = true, templateId: templateIdRaw, templateTitle, templateVer = 0 } = {},
  ) {
    const [workflowTemplateService] = await this.service(['workflowTemplateService']);

    await ensureAdmin(requestContext);
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');

    const now = new Date().toISOString();
    const templateId = slugify(_.kebabCase(_.startsWith(templateIdRaw, 'wt-') ? templateIdRaw : `wt-${templateIdRaw}`));
    const draftId = `${by}_${templateId}_${templateVer}`;
    const draft = {
      id: draftId,
      templateVer,
      templateId,
      uid: by,
    };

    if (isNewTemplate) {
      const existing = await workflowTemplateService.findVersion({ id: templateId });
      if (existing) throw this.boom.badRequest('A workflow template with the same template id exists.', true);

      draft.template = {
        id: templateId,
        title: templateTitle || 'Untitled',
        v: 1,
        rev: 0,
        runSpec: {
          target: 'stepFunctions',
          size: 'small',
        },
        propsOverrideOption: {
          allowed: [],
        },
        hidden: false,
        builtin: false,
        createdBy: by,
        updatedBy: by,
        updatedAt: now,
        createdAt: now,
      };
    } else {
      // if it is not a new template, then we do not use the title
      if (!_.isEmpty(templateTitle))
        throw this.boom.badRequest(
          'The title can not be changed at the time of create a draft of an existing template',
          true,
        );
      draft.template = await workflowTemplateService.mustFindVersion({ id: templateId, v: templateVer });
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
          `A draft for the same workflow template "${templateId}" already exists, you can not create two drafts for the same workflow template`,
          true,
        );
      },
    );

    // Write audit event
    await this.audit(requestContext, { action: 'create-workflow-template-draft', body: result });

    return result;
  }

  async updateDraft(requestContext, draft = {}) {
    const [jsonSchemaValidationService, workflowTemplateService] = await this.service([
      'jsonSchemaValidationService',
      'workflowTemplateService',
    ]);

    await ensureAdmin(requestContext);
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');

    const template = draft.template;
    const originalDraft = await this.mustFindDraft({ id: draft.id });

    // Check if the owner of this draft is the same entity that is trying to update the draft
    if (originalDraft.uid !== by) throw this.boom.forbidden('You are not authorized to perform this operation', true);

    if (!_.isObject(template)) throw this.boom.badRequest('The provided template is not a valid JSON object', true);
    if (_.isUndefined(template.id)) throw this.boom.badRequest('The provided template is missing an id', true);

    let originalTemplate = originalDraft.template;
    if (template.id !== originalTemplate.id || template.v !== originalTemplate.v) {
      originalTemplate = await workflowTemplateService.mustFindVersion({ id: template.id, v: template.v });
    }

    const mergedTemplate = { ...originalTemplate, ...template };
    if (_.isEmpty(_.trim(mergedTemplate.desc))) delete mergedTemplate.desc;

    // Validate the template manifest
    await jsonSchemaValidationService.ensureValid(
      _.omit(template, ['rev', 'updatedBy', 'updatedAt', 'createdBy', 'createdAt']),
      inputSchema,
    );

    // Populate step template prop in the selected steps and the step ids if needed
    await workflowTemplateService.populateSteps(mergedTemplate);

    const mergedDraft = _.omit({ ...originalDraft, ...draft }, ['updatedAt', 'updatedBy']);
    mergedDraft.template = mergedTemplate;
    mergedDraft.templateId = mergedTemplate.id;
    mergedDraft.templateVer = mergedTemplate.v;

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
    await this.audit(requestContext, { action: 'update-workflow-template-draft', body: result });

    return result;
  }

  async publishDraft(requestContext, draft = {}) {
    const [workflowTemplateService] = await this.service(['workflowTemplateService']);
    const publishResult = {};

    // First we simply update the draft, this ensures that certain constraints are checked
    const updatedDraft = await this.updateDraft(requestContext, draft);

    // TODO: loop through each step and ensure that the 'defaults' are validated against the step adminInputManifest (or inputManifest, if adminInputManifest was not provided in the yaml file)

    // We need to loop through all the steps and remove the step template, otherwise the createVersion won't work
    const template = updatedDraft.template;
    _.forEach(template.selectedSteps, step => {
      delete step.stepTemplate;
      delete step.isNew;
    });

    // we also need to remove certain fields
    delete template.rev;
    delete template.updatedAt;
    delete template.updatedBy;
    delete template.createdAt;
    delete template.createdBy;

    // Now we need to determine the version we want to create for the template. This is a bit tricky and the solution here
    // is not perfect as it has a slight chance of failing if someone managed to start publishing another draft for the same template
    // at the same time.
    // Anyway, we have two cases:
    // - The draft is trying to publish a template that never existed
    // - The draft is trying to publish a template that exists

    const existing = await workflowTemplateService.findVersion({ id: template.id });
    let newVersion = 1;

    if (existing) {
      newVersion = existing.v + 1;
    }

    template.v = newVersion;
    const publishedTemplate = await workflowTemplateService.createVersion(requestContext, template);

    publishResult.template = publishedTemplate;
    publishResult.hasErrors = false;

    await this.deleteDraft(requestContext, { id: draft.id });

    // Write audit event
    await this.audit(requestContext, { action: 'publish-workflow-template-draft', body: publishResult });

    return publishResult;
  }

  async deleteDraft(requestContext, { id }) {
    await ensureAdmin(requestContext);
    // For now, we assume that 'createdBy' and 'updatedBy' are always users and not groups
    const by = _.get(requestContext, 'principalIdentifier.uid');
    const originalDraft = await this.mustFindDraft({ id });

    // Check if the owner of this draft is the same entity that is trying to delete the draft
    if (originalDraft.uid !== by) throw this.boom.forbidden('You are not authorized to perform this operation', true);

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
    await this.audit(requestContext, { action: 'delete-workflow-template-draft', body: { id } });
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
    if (!draft) throw this.boom.notFound(`The workflow template draft "${id}" is not found`, true);
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

module.exports = WorkflowTemplateDraftService;
