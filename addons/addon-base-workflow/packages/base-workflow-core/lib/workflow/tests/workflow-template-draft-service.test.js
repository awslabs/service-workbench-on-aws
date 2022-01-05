const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const StepTemplateService = require('../step/step-template-service');
const WorkflowTemplateService = require('../workflow-template-service');
const WorkflowTemplateDraftService = require('../workflow-template-draft-service');

// jest.mock('@aws-ee/base-workflow-core/workflow-draft-service');
jest.mock('../step/step-template-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('../workflow-template-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');

describe('WorkflowTemplateDraftService', () => {
  let workflowTemplateDraftService;
  let dbService;
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('workflowTemplateDraftService', new WorkflowTemplateDraftService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('workflowTemplateService', new WorkflowTemplateService());
    container.register('stepTemplateService', new StepTemplateService());
    container.register('dbService', new DbService());
    container.register('auditWriterService', new AuditWriterService());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();

    workflowTemplateDraftService = await container.find('workflowTemplateDraftService');
    dbService = await container.find('dbService');
    const workflowTemplateService = await container.find('workflowTemplateService');
    WorkflowTemplateDraftService._settings = {
      get: settingName => {
        if (settingName === 'dbWorkflowTemplateDrafts') {
          return 'WorkflowTemplateDrafts';
        }
        return undefined;
      },
    };

    workflowTemplateService.mustFindVersion = jest.fn(() => {
      return [
        {
          stepTemplateId: 'template1',
          stepTemplateVersion: '1',
          id: '123',
          title: '',
          desc: '',
          skippable: true,
        },
      ];
    });

    workflowTemplateService.populateSteps = jest.fn();

    workflowTemplateDraftService.mustFindDraft = jest.fn(() => {
      const draft = {
        uid: 'owner-user',
        template: { id: 'sample-workflow-template-id', v: 0 },
        id: 'sample-draft-template-id',
      };
      return draft;
    });
  });
  describe('updateDraft', () => {
    it('should successfully update a draft', async () => {
      const uid = 'owner-user';
      const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };

      const updateFn = jest.fn();
      dbService.table.update = updateFn;

      const draft = {
        template: { id: 'sample-template-id', v: 1, propsOverrideOption: {}, selectedSteps: [], title: 'Untitled' },
        templateId: 'sample-workflow-template-id',
        id: 'sample-draft-id',
      };

      await workflowTemplateDraftService.updateDraft(requestContext, draft);
      expect(updateFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should throw error when given invalid template', async () => {
    const uid = 'owner-user';
    const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };

    const updateFn = jest.fn();
    dbService.table.update = updateFn;

    const draft = {
      template: '<object>',
      templateId: 'sample-workflow-template-id',
      id: 'sample-draft-id',
    };

    await expect(workflowTemplateDraftService.updateDraft(requestContext, draft)).rejects.toThrow(
      new Error('The provided template is not a valid JSON object'),
    );
  });

  it('should throw error when given template is missing an id', async () => {
    const uid = 'owner-user';
    const requestContext = { principalIdentifier: { uid }, principal: { isAdmin: true, status: 'active' } };

    const updateFn = jest.fn();
    dbService.table.update = updateFn;

    const draft = {
      template: { v: '0' },
      templateId: 'sample-workflow-template-id',
      id: 'sample-draft-id',
    };

    await expect(workflowTemplateDraftService.updateDraft(requestContext, draft)).rejects.toThrow(
      new Error('The provided template is missing an id'),
    );
  });
});
