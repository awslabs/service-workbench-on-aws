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
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

jest.mock('@aws-ee/base-raas-services/lib/alb/alb-service');
const AlbServiceMock = require('@aws-ee/base-raas-services/lib/alb/alb-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/environment-dns-service');
const EnvironmentDnsServiceMock = require('@aws-ee/base-raas-services/lib/environment/environment-dns-service');

const TerminateLaunchDependency = require('../terminate-launch-dependency/terminate-launch-dependency');

describe('TerminateLaunchDependencyStep', () => {
  let albService = null;
  let lockService = null;
  let environmentScService = null;
  let environmentDnsService = null;
  let cfn;
  const requestContext = {
    principal: {
      isAdmin: true,
      status: 'active',
    },
  };
  const meta = { workflowId: `wf-terminate-environment-sc` };
  const input = {
    envId: 'test-env-id',
    envName: 'test-env-name',
    requestContext,
    xAccEnvMgmtRoleArn: 'test-role-arn',
    externalId: 'test-external-id',
    provisionedProductId: 'test-pp-id',
    existingEnvironmentStatus: 'test-env-status',
  };
  let container;

  const step = new TerminateLaunchDependency({
    step: { config: {} },
    workflowPayload: new WorkflowPayload({
      meta,
      input,
      container,
      workflowInstance: { steps: ['st-terminate-launch-dependency'] },
    }),
  });

  beforeAll(async () => {
    container = new ServicesContainer();
    container.register('albService', new AlbServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('environmentDnsService', new EnvironmentDnsServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    albService = await container.find('albService');
    lockService = await container.find('lockService');
    environmentScService = await container.find('environmentScService');
    environmentDnsService = await container.find('environmentDnsService');

    step.payloadOrConfig = {
      string: stringInput => {
        return stringInput;
      },
      object: () => {
        return requestContext;
      },
    };

    step.state = {
      setKey: jest.fn(),
      ...step.payloadOrConfig,
    };

    step.container = container;

    step.print = jest.fn();
    step.payload.setKey = jest.fn();
    step.state.setKey = jest.fn();
  });

  beforeEach(async () => {
    cfn = {
      deleteStack: jest.fn(),
    };
    step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
    albService.findAwsAccountId = jest.fn(() => {
      return 'test-account-id';
    });
    lockService.tryWriteLock = jest.fn(() => {
      return 'test-lock-id';
    });
    step.cfnOutputsArrayToObject = jest.fn(() => {
      return {
        MetaConnection1Type: 'rstudio',
        ListenerRuleARN: null,
      };
    });
    environmentScService.mustFind = jest.fn(() => {
      return {
        projectId: 'test-project-id',
        envTypeId: 'test-env-type-id',
      };
    });
    const albDetails = {
      createdAt: '2021-05-21T13:06:58.216Z',
      id: 'test-id',
      type: 'account-workspace-details',
      updatedAt: '2021-05-31T13:32:15.503Z',
      value:
        '{"id":"test-id","albStackName":null,"albArn":null,"listenerArn":null,"albDnsName":null,"albDependentWorkspacesCount":1}',
    };
    albService.getAlbDetails = jest.fn(() => {
      return albDetails;
    });
  });

  afterEach(() => {
    // Restore all the mocks crated using spy to original funciton behaviour
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should throw error when aws account id retrival fails', async () => {
      albService.findAwsAccountId.mockImplementationOnce(() => {
        throw new Error('project with id "test-project" does not exist');
      });
      await expect(step.start()).rejects.toThrow('project with id "test-project" does not exist');
    });

    it('should throw error obtaining lock fails', async () => {
      lockService.tryWriteLock.mockImplementationOnce(() => {
        return undefined;
      });
      await expect(step.start()).rejects.toThrow('Could not obtain a lock');
    });

    it('should not delete route53 record and rule if type is not RstudioV2', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudio',
          ListenerRuleARN: null,
        };
      });
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      environmentDnsService.deleteRecord.mockImplementationOnce(() => {});
      albService.deleteListenerRule.mockImplementationOnce(() => {});
      await step.start();
      expect(environmentDnsService.deleteRecord).not.toHaveBeenCalled();
      expect(albService.deleteListenerRule).not.toHaveBeenCalled();
    });

    it('should call delete route53 record if type is RstudioV2 and alb exists', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudiov2',
          ListenerRuleARN: null,
        };
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return true;
      });
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      environmentDnsService.deleteRecord.mockImplementationOnce(() => {});
      await step.start();
      expect(environmentDnsService.deleteRecord).toHaveBeenCalled();
    });

    it('should not call delete route53 record if type is RstudioV2 and alb not exists', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudiov2',
          ListenerRuleARN: null,
        };
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return false;
      });
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      environmentDnsService.deleteRecord.mockImplementationOnce(() => {});
      await step.start();
      expect(environmentDnsService.deleteRecord).not.toHaveBeenCalled();
    });

    it('should call delete rule if type is RstudioV2 and rule arn exist', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudiov2',
          ListenerRuleARN: 'rule-arn',
        };
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return false;
      });
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      albService.deleteListenerRule.mockImplementationOnce(() => {});
      await step.start();
      expect(albService.deleteListenerRule).toHaveBeenCalled();
    });

    it('should not call delete rule if type is RstudioV2 and rule arn not exist', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudiov2',
          ListenerRuleARN: null,
        };
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return false;
      });
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      albService.deleteListenerRule.mockImplementationOnce(() => {});
      await step.start();
      expect(albService.deleteListenerRule).not.toHaveBeenCalled();
    });

    it('should not terminate if needsAlb is false', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudio',
          ListenerRuleARN: null,
        };
      });
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      jest.spyOn(step, 'checkAndTerminateAlb').mockImplementationOnce(() => {});
      await step.start();
      expect(step.checkAndTerminateAlb).not.toHaveBeenCalled();
    });

    it('should call terminate if needsAlb is true', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: true },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudio',
          ListenerRuleARN: null,
        };
      });
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      jest.spyOn(step, 'checkAndTerminateAlb').mockImplementationOnce(() => {});
      await step.start();
      expect(step.checkAndTerminateAlb).toHaveBeenCalled();
    });
  });

  describe('checkAndTerminateAlb', () => {
    it('should throw error when project is not valid', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        throw new Error('project with id "test-project" does not exist');
      });
      await expect(step.checkAndTerminateAlb(requestContext, 'test-project-id', 'test-external-id')).rejects.toThrow(
        'project with id "test-project" does not exist',
      );
    });

    it('should skip alb termination when count > 0', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        return 1;
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return true;
      });
      jest.spyOn(step, 'terminateStack').mockImplementationOnce(() => {});
      await step.checkAndTerminateAlb('test-project-id', 'test-external-id');
      // CHECK
      expect(step.terminateStack).not.toHaveBeenCalled();
    });

    it('should skip alb termination when alb does not exist', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        return 0;
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return false;
      });
      jest.spyOn(step, 'terminateStack').mockImplementationOnce(() => {});
      await step.checkAndTerminateAlb('test-project-id', 'test-external-id');
      // CHECK
      expect(step.terminateStack).not.toHaveBeenCalled();
    });

    it('should call alb termination when count <= 0', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        return 0;
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return true;
      });
      jest.spyOn(step, 'checkAndTerminateAlb').mockImplementationOnce(() => {});
      await step.checkAndTerminateAlb('test-project-id', 'test-external-id');
      // CHECK
      expect(step.checkAndTerminateAlb).toHaveBeenCalled();
    });
  });

  describe('terminateStack', () => {
    it('should throw error when project is not valid', async () => {
      jest.spyOn(step, 'getCloudFormationService').mockImplementationOnce(() => {
        throw new Error('project with id "test-project" does not exist');
      });
      await expect(
        step.terminateStack(requestContext, 'test-project-id', 'test-external-id', 'test-stack-name'),
      ).rejects.toThrow('project with id "test-project" does not exist');
    });

    it('should call delete stack and set stack id on success', async () => {
      cfn.deleteStack = jest.fn().mockImplementation(() => {
        return {
          promise: () => {},
        };
      });
      step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
      await step.terminateStack(requestContext, 'test-project-id', 'test-external-id', 'test-stack-id');
      // CHECK
      expect(cfn.deleteStack).toHaveBeenCalled();
      expect(step.state.setKey).toHaveBeenCalledWith('STACK_ID', 'test-stack-id');
    });

    it('should return resolved promise', async () => {
      cfn.deleteStack = jest.fn().mockImplementation(() => {
        return {
          promise: () => {},
        };
      });
      step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
      // OPERATE
      const response = await step.terminateStack(
        requestContext,
        'test-project-id',
        'test-external-id',
        'test-stack-id',
      );
      // CHECK
      expect(response).toMatchObject({
        waitDecision: {
          check: { methodName: 'shouldResumeWorkflow', params: '[]' },
          counter: 1296000,
          max: 1296000,
          otherwise: { methodName: 'reportTimeout', params: '[]' },
          seconds: 5,
          thenCall: { methodName: 'onSuccessfulCompletion', params: '[]' },
          type: 'wait',
        },
      });
    });
  });

  describe('onSuccessfulCompletion', () => {
    it('should throw error when aws account id retrival fails', async () => {
      albService.findAwsAccountId.mockImplementationOnce(() => {
        throw new Error('project with id "test-project" does not exist');
      });
      await expect(step.onSuccessfulCompletion([])).rejects.toThrow('project with id "test-project" does not exist');
    });

    it('should update alb details with null on success', async () => {
      albService.findAwsAccountId.mockImplementationOnce(() => {
        return 'test-account-id';
      });
      jest.spyOn(albService, 'saveAlbDetails').mockImplementationOnce(() => {});
      const albDetails = {
        id: 'test-account-id',
        albStackName: null,
        albArn: null,
        listenerArn: null,
        albDnsName: null,
        albDependentWorkspacesCount: 0,
      };
      await step.onSuccessfulCompletion([]);
      expect(albService.saveAlbDetails).toHaveBeenCalledWith('test-account-id', albDetails);
    });
  });
});
