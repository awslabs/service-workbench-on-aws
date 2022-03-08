const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const DbService = require('@aws-ee/base-services/lib/db-service');
const AuditWriterService = require('@aws-ee/base-services/lib/audit/audit-writer-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const Aws = require('@aws-ee/base-services/lib/aws/aws-service');
const AWSMock = require('aws-sdk-mock');
const WorkflowTriggerService = require('../workflow-trigger-service');
const WorkflowService = require('../workflow-service');
const WorkflowInstanceService = require('../workflow-instance-service');

jest.mock('../step/step-template-service');
jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('../workflow-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');

describe('WorkflowDraftService', () => {
  let workflowTriggerService;
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('aws', new Aws());
    container.register('workflowTriggerService', new WorkflowTriggerService());
    container.register('workflowInstanceService', new WorkflowInstanceService());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('workflowService', new WorkflowService());
    container.register('dbService', new DbService());
    container.register('auditWriterService', new AuditWriterService());
    container.register('settings', new SettingsServiceMock());
    await container.initServices();

    workflowTriggerService = await container.find('workflowTriggerService');
    const workflowInstanceService = await container.find('workflowInstanceService');
    const aws = await workflowTriggerService.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
    workflowInstanceService.createInstance = jest.fn(() =>
      Promise.resolve({
        workflow: {
          instanceTtl: 30,
          stepsOrderChanged: true,
          workflowTemplateId: 'wt-empty',
          runSpec: { size: 'small', target: 'stepFunctions' },
          selectedSteps: [[Object]],
          hidden: false,
          v: 1,
          builtin: true,
          id: 'wf-start-ec2-environment-sc',
          workflowTemplateVer: 1,
          title: 'Start an Service Catalog EC2 instance',
        },
        runSpec: { size: 'small', target: 'stepFunctions' },
        wfVer: 1,
        createdAt: '2022-02-07T19:03:01.190Z',
        ttl: 1646852581,
        updatedBy: 'u-VEB9d7r3rYJyFFylYSuWl',
        createdBy: 'u-VEB9d7r3rYJyFFylYSuWl',
        wfId: 'wf-start-ec2-environment-sc',
        wf: 'wf-start-ec2-environment-sc_1',
        updatedAt: '2022-02-07T19:03:01.190Z',
        input: {
          instanceIdentifier: 'some-ec2-instance-id',
          environmentId: '1234567',
          roleExternalId: 'roleExternalId',
          cfnExecutionRole: 'cfnExecutionRole',
        },
        stStatuses: [{ status: 'not_started' }],
        id: 'BCigolBoG4svWa0uiZTR9',
        wfStatus: 'not_started',
      }),
    );
  });
  afterEach(() => {
    AWSMock.restore();
  });
  describe('triggerWorkflow', () => {
    it('should successfully triggerWorkflow', async () => {
      // BUILD
      const requestContext = {};
      const meta = {
        workflowId: 'wf-start-ec2-environment-sc',
        workflowVer: 1,
        smWorkflow: 'arn:aws:states:eu-west-3:111111111111:stateMachine:abc',
      };

      const input = {
        environmentId: '1234567',
        instanceIdentifier: 'some-ec2-instance-id',
        cfnExecutionRole: 'cfnExecutionRole',
        roleExternalId: 'roleExternalId',
      };
      AWSMock.mock('StepFunctions', 'startExecution', (params, callback) => {
        callback(null, {
          executionArn:
            'arn:aws:states:eu-west-3:111111111111:execution:abc:wf-start-ec2-environment-sc_1_BCigolBoG4svWa0uiZTR9',
        });
      });

      // OPERATE, CHECK
      await expect(workflowTriggerService.triggerWorkflow(requestContext, meta, input)).resolves.toMatchObject({
        executionArn:
          'arn:aws:states:eu-west-3:111111111111:execution:abc:wf-start-ec2-environment-sc_1_BCigolBoG4svWa0uiZTR9',
        instance: {
          id: 'BCigolBoG4svWa0uiZTR9',
          input: {
            cfnExecutionRole: 'cfnExecutionRole',
            environmentId: '1234567',
            instanceIdentifier: 'some-ec2-instance-id',
            roleExternalId: 'roleExternalId',
          },
        },
      });
    });
  });
  it('should throw error because Step Function cannot execute state machine', async () => {
    // BUILD
    const requestContext = {};
    const meta = {
      workflowId: 'wf-start-ec2-environment-sc',
      workflowVer: 1,
      smWorkflow: 'arn:aws:states:eu-west-3:foo',
    };
    const input = {
      environmentId: '1234567',
      instanceIdentifier: 'some-ec2-instance-id',
      cfnExecutionRole: 'cfnExecutionRole',
      roleExternalId: 'roleExternalId',
    };
    AWSMock.mock('StepFunctions', 'startExecution', (params, callback) => {
      callback({ code: 'InvalidArn' }, {});
    });

    const params = {
      stateMachineArn: 'arn:aws:states:eu-west-3:foo',
      input:
        '{"meta":{"workflowId":"wf-start-ec2-environment-sc","workflowVer":1,"smWorkflow":"arn:aws:states:eu-west-3:foo","wid":"wf-start-ec2-environment-sc","sid":"BCigolBoG4svWa0uiZTR9","wrv":1},"input":{"environmentId":"1234567","instanceIdentifier":"some-ec2-instance-id","cfnExecutionRole":"cfnExecutionRole","roleExternalId":"roleExternalId"}}',
      name: 'wf-start-ec2-environment-sc_1_BCigolBoG4svWa0uiZTR9',
    };

    // OPERATE, CHECK
    await expect(workflowTriggerService.triggerWorkflow(requestContext, meta, input)).rejects.toThrow(
      `Step Function could not start execution for State Machine arn:aws:states:eu-west-3:foo with params ${JSON.stringify(
        params,
      )}. Error code: InvalidArn`,
    );
  });
});
