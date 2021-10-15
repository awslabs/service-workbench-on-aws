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
const StartRStudioEnvironmentSc = require('../start-rstudio-environment/start-rstudio-environment-sc');

describe('StartRStudioEnvironmentStep', () => {
  const requestContext = {
    principal: {
      isAdmin: true,
      status: 'active',
    },
  };

  const meta = { workflowId: `wf-start-rstudio-environment-sc` };
  const input = {
    environmentId: 12345678,
    instanceIdentifier: 'ec2-instance-id',
    requestContext,
    cfnExecutionRole: 'exe-role-arn',
    roleExternalId: 'swb',
  };

  const step = new StartRStudioEnvironmentSc({
    step: { config: {} },
    workflowPayload: new WorkflowPayload({
      meta,
      input,
      workflowInstance: { steps: ['st-start-rstudio-environment-sc'] },
    }),
  });
  let ec2;

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
    ec2 = {
      describeInstances: jest.fn(),
      describeInstanceStatus: jest.fn(),
      startInstances: jest.fn(),
    };
    step.getEc2Service = jest.fn().mockResolvedValue(ec2);
    step.getExistingEnvironmentRecord = jest.fn(() => {});
    step.updateEnvironment = jest.fn(() => {});
  });

  afterEach(() => {});

  describe('start', () => {
    it('should throw error when ec2 describe instance throw error', async () => {
      // BUILD
      ec2.describeInstanceStatus = jest.fn().mockImplementation(() => {
        throw new Error('EC2 describe error message');
      });
      step.getEc2Service = jest.fn().mockResolvedValue(ec2);
      // OPERATE n CHECK
      await expect(step.start()).rejects.toThrow('EC2 describe error message');
    });

    it('should skip ec2 start call if the status is RUNNING', async () => {
      // BUILD
      ec2.describeInstanceStatus = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { InstanceStatuses: [{ InstanceState: { Name: 'running' } }] };
          },
        };
      });
      step.getEc2Service = jest.fn().mockResolvedValue(ec2);
      // OPERATE
      await step.start();
      // CHECK
      expect(ec2.startInstances).not.toHaveBeenCalled();
    });

    it('should throw EC2 instance is not stopped error if instance status is STOPPING', async () => {
      // BUILD
      ec2.describeInstanceStatus = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { InstanceStatuses: [{ InstanceState: { Name: 'stopping' } }] };
          },
        };
      });
      step.getEc2Service = jest.fn().mockResolvedValue(ec2);
      // OPERATE n CHECK
      await expect(step.start()).rejects.toThrow('EC2 instance [instanceIdentifier] is not stopped');
    });

    it('should throw error when ec2 start instance throw error', async () => {
      // BUILD
      ec2.describeInstanceStatus = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { InstanceStatuses: [{ InstanceState: { Name: 'stopped' } }] };
          },
        };
      });
      ec2.startInstances = jest.fn().mockImplementation(() => {
        throw new Error('EC2 start instance error message');
      });
      step.getEc2Service = jest.fn().mockResolvedValue(ec2);
      // OPERATE n CHECK
      await expect(step.start()).rejects.toThrow('EC2 start instance error message');
    });

    it('should return resolved promise', async () => {
      // BUILD
      ec2.describeInstanceStatus = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { InstanceStatuses: [{ InstanceState: { Name: 'stopped' } }] };
          },
        };
      });
      ec2.startInstances = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return {};
          },
        };
      });
      step.getEc2Service = jest.fn().mockResolvedValue(ec2);

      // OPERATE n
      const response = await step.start();

      // CHECK
      expect(response).toMatchObject({
        waitDecision: {
          check: { methodName: 'checkInstanceStarted', params: '[]' },
          counter: 120,
          max: 120,
          otherwise: undefined,
          seconds: 5,
          thenCall: { methodName: 'updateEnvironmentStatusAndIp', params: '[]' },
          type: 'wait',
        },
      });
    });
  });

  describe('updateCnameRecords', () => {
    it('delete/create called when AppStream is disabled', async () => {
      const environmentDnsService = {};
      environmentDnsService.deleteRecord = jest.fn();
      environmentDnsService.createRecord = jest.fn();
      step.mustFindServices = () => environmentDnsService;
      step.settings = {
        getBoolean: key => {
          if (key === 'isAppStreamEnabled') {
            return false;
          }
          throw new Error('Unexpected key');
        },
      };
      await step.updateCnameRecords('testEnv', 'old.dns', 'new.dns');
      expect(environmentDnsService.deleteRecord).toHaveBeenCalledTimes(1);
      expect(environmentDnsService.createRecord).toHaveBeenCalledTimes(1);
      expect(environmentDnsService.deleteRecord).toHaveBeenCalledWith('rstudio', 'testEnv', 'old.dns');
      expect(environmentDnsService.createRecord).toHaveBeenCalledWith('rstudio', 'testEnv', 'new.dns');
    });

    it('delete/create not called when AppStream is enabled', async () => {
      const environmentDnsService = {};
      environmentDnsService.deleteRecord = jest.fn();
      environmentDnsService.createRecord = jest.fn();
      step.mustFindServices = () => environmentDnsService;
      step.settings = {
        getBoolean: key => {
          if (key === 'isAppStreamEnabled') {
            return true;
          }
          throw new Error('Unexpected key');
        },
      };
      await step.updateCnameRecords('testEnv', 'old.dns', 'new.dns');
      expect(environmentDnsService.deleteRecord).not.toHaveBeenCalled();
      expect(environmentDnsService.createRecord).not.toHaveBeenCalled();
    });
  });
});
