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

const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const StopSagemakerEnvironmentSc = require('../stop-sagemaker-environment/stop-sagemaker-environment-sc');

describe('StopSageMakerEnvironmentStep', () => {
  const requestContext = {
    principal: {
      isAdmin: true,
      status: 'active',
    },
  };

  const meta = { workflowId: `wf-stop-sagemaker-environment-sc` };
  const input = {
    environmentId: 12345678,
    instanceIdentifier: 'sagemaker-instance-name',
    requestContext,
    cfnExecutionRole: 'exe-role-arn',
    roleExternalId: 'swb',
  };

  const step = new StopSagemakerEnvironmentSc({
    step: { config: {} },
    workflowPayload: new WorkflowPayload({
      meta,
      input,
      workflowInstance: { steps: ['st-stop-sagemaker-environment-sc'] },
    }),
  });
  let sagemaker;

  beforeAll(async () => {
    step.payload = {
      string: stringInput => {
        return stringInput;
      },
      object: () => {
        return requestContext;
      },
    };

    step.state = {
      setKey: jest.fn(),
      ...step.payload,
    };
  });

  beforeEach(async () => {
    sagemaker = {
      describeNotebookInstance: jest.fn(),
      stopNotebookInstance: jest.fn(),
    };
    step.getSageMakerService = jest.fn().mockResolvedValue(sagemaker);
    step.getExistingEnvironmentRecord = jest.fn(() => {});
    step.updateEnvironmentStatus = jest.fn(() => {});
  });

  afterEach(() => {});

  describe('start', () => {
    it('should throw error when sagemaker describe instance throw error', async () => {
      // BUILD
      sagemaker.describeNotebookInstance = jest.fn().mockImplementation(() => {
        throw new Error('sagemaker describe error message');
      });
      step.getSageMakerService = jest.fn().mockResolvedValue(sagemaker);
      // OPERATE n CHECK
      await expect(step.start()).rejects.toThrow('sagemaker describe error message');
    });

    it('should skip sagemaker start call if the status is STOPPED', async () => {
      // BUILD
      sagemaker.describeNotebookInstance = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { NotebookInstanceStatus: 'stopped' };
          },
        };
      });
      step.getSageMakerService = jest.fn().mockResolvedValue(sagemaker);
      // OPERATE
      await step.start();
      // CHECK
      expect(sagemaker.stopNotebookInstance).not.toHaveBeenCalled();
    });

    it('should throw notebook is not stopped error if instance status is STARTING', async () => {
      // BUILD
      sagemaker.describeNotebookInstance = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { NotebookInstanceStatus: 'starting' };
          },
        };
      });
      step.getSageMakerService = jest.fn().mockResolvedValue(sagemaker);
      // OPERATE n CHECK
      await expect(step.start()).rejects.toThrow('Notebook instance [instanceIdentifier] is not running');
    });

    it('should throw error when sagemaker stop instance throw error', async () => {
      // BUILD
      sagemaker.describeNotebookInstance = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { NotebookInstanceStatus: 'inservice' };
          },
        };
      });
      sagemaker.stopNotebookInstance = jest.fn().mockImplementation(() => {
        throw new Error('sagemaker stop instance error message');
      });
      step.getSageMakerService = jest.fn().mockResolvedValue(sagemaker);
      // OPERATE n CHECK
      await expect(step.start()).rejects.toThrow('sagemaker stop instance error message');
    });

    it('should return resolved promise', async () => {
      // BUILD
      sagemaker.describeNotebookInstance = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { NotebookInstanceStatus: 'inservice' };
          },
        };
      });
      sagemaker.stopNotebookInstance = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return {};
          },
        };
      });
      step.getSageMakerService = jest.fn().mockResolvedValue(sagemaker);

      // OPERATE
      const response = await step.start();

      // CHECK
      expect(response).toMatchObject({
        waitDecision: {
          check: { methodName: 'checkNotebookStopped', params: '[]' },
          counter: 120,
          max: 120,
          otherwise: undefined,
          seconds: 5,
          thenCall: { methodName: 'updateEnvironmentStatusToStopped', params: '[]' },
          type: 'wait',
        },
      });
    });
  });
});
