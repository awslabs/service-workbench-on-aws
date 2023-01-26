const ServicesContainer = require('@amzn/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@amzn/base-services/lib/json-schema-validation-service');
const DbService = require('@amzn/base-services/lib/db-service');
const AuditWriterService = require('@amzn/base-services/lib/audit/audit-writer-service');
const SettingsServiceMock = require('@amzn/base-services/lib/settings/env-settings-service');
const StepTemplateService = require('../step/step-template-service');
const WorkflowTemplateService = require('../workflow-template-service');
const WorkflowDraftService = require('../workflow-draft-service');
const WorkflowService = require('../workflow-service');

jest.mock('../step/step-template-service');
jest.mock('@amzn/base-services/lib/audit/audit-writer-service');
jest.mock('@amzn/base-services/lib/db-service');
jest.mock('../workflow-template-service');
jest.mock('../workflow-service');
jest.mock('@amzn/base-services/lib/settings/env-settings-service');

describe('WorkflowDraftService', () => {
  let workflowDraftService;
  let dbService;
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('workflowDraftService', new WorkflowDraftService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('workflowTemplateService', new WorkflowTemplateService());
    container.register('workflowService', new WorkflowService());
    container.register('stepTemplateService', new StepTemplateService());
    container.register('dbService', new DbService());
    container.register('auditWriterService', new AuditWriterService());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();

    workflowDraftService = await container.find('workflowDraftService');
    dbService = await container.find('dbService');
    const workflowTemplateService = await container.find('workflowTemplateService');
    workflowDraftService._settings = {
      get: settingName => {
        if (settingName === 'dbWorkflowDrafts') {
          return 'WorkflowDrafts';
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
  });
  describe('createDraft', () => {
    it('should successfully create a draft', async () => {
      const requestContext = {};

      const updateFn = jest.fn();
      dbService.table.update = updateFn;

      await workflowDraftService.createDraft(requestContext, {
        workflowId: 'workflow-test-1',
        templateId: 'template-1',
      });
      expect(updateFn).toHaveBeenCalledTimes(1);
    });
  });
  describe('updateDraft', () => {
    it('should fail with unsafe code', async () => {
      const requestContext = {};

      const updateFn = jest.fn();
      dbService.table.update = updateFn;
      try {
        await workflowDraftService.updateDraft(requestContext, {
          workflowId: 'workflow-test-1',
          templateId: 'template-1',
          selectedSteps: [{
            stepTemplateId: 'stepId',
            stepTemplateVer: 0,
            title: '<script>console.log("unsafe code")</script>',
            desc: 'desc',
            skippable: true,
            configs: {},
            id: 'id',
          }]
        });
        expect.hasAssertions();
      }
      catch (err) {
        expect(err.message).toEqual('Input has validation errors');
      }
    });
  });
  describe('publishDraft', () => {
    it('should fail with unsafe code', async () => {
      const requestContext = {};

      const updateFn = jest.fn();
      dbService.table.update = updateFn;
      try {
        await workflowDraftService.publishDraft(requestContext, {
          workflowId: 'workflow-test-1',
          templateId: 'template-1',
          selectedSteps: [{
            stepTemplateId: 'stepId',
            stepTemplateVer: 0,
            title: '<script>console.log("unsafe code")</script>',
            desc: 'desc',
            skippable: true,
            configs: {},
            id: 'id',
          }]
        });
        expect.hasAssertions();
      }
      catch (err) {
        expect(err.message).toEqual('Input has validation errors');
      }
    });
  });
  it('should throw error when given invalid draftId', async () => {
    const requestContext = {};

    await expect(
      workflowDraftService.createDraft(requestContext, {
        workflowId: 'workflow with spaces',
        templateId: 'template-1',
      }),
    ).rejects.toThrow(
      new Error(
        'Workflow id "workflow with spaces" is not valid. The number of characters must be between 3 and 100 and no spaces. Only alpha-numeric characters, dashes, and underscores are allowed.',
      ),
    );
  });

  describe('isWorkFlowDraftIdValid', () => {
    it('valid workflow draft id', () => {
      expect(workflowDraftService.isWorkFlowDraftIdValid('validId')).toEqual(true);
    });
    it('Invalid workflow draft id: contains spaces', () => {
      expect(workflowDraftService.isWorkFlowDraftIdValid('two words')).toEqual(false);
    });
    it('Invalid workflow draft id: contains non-alphanumeric character', () => {
      expect(workflowDraftService.isWorkFlowDraftIdValid('!@')).toEqual(false);
    });
    it('Invalid workflow draft id: less than 3 char', () => {
      expect(workflowDraftService.isWorkFlowDraftIdValid('ab')).toEqual(false);
    });
    it('Invalid workflow draft id: unsafe code', () => {
      expect(workflowDraftService.isWorkFlowDraftIdValid('<script>console.log("**hacker voice** I\'m in")</script>')).toEqual(false);
    });
    it('Invalid workflow draft id: longer than 100 char', () => {
      expect(
        workflowDraftService.isWorkFlowDraftIdValid(
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        ),
      ).toEqual(false);
    });
  });
});
