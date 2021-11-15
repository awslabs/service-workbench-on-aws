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

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

jest.mock('@aws-ee/base-raas-services/lib/alb/alb-service');
const AlbServiceMock = require('@aws-ee/base-raas-services/lib/alb/alb-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryServiceMock = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('../../../../environment-type-mgmt-services/lib/environment-type/env-type-config-service.js');
const EnvTypeConfigServiceMock = require('../../../../environment-type-mgmt-services/lib/environment-type/env-type-config-service.js');

jest.mock('../../../../environment-type-mgmt-services/lib/environment-type/env-type-service.js');
const EnvTypeServiceMock = require('../../../../environment-type-mgmt-services/lib/environment-type/env-type-service.js');

const CheckLaunchDependency = require('../check-launch-dependency/check-launch-dependency');

describe('CheckLaunchDependencyStep', () => {
  let albService = null;
  let lockService = null;
  let envTypeConfigService = null;
  let pluginRegistryService = null;
  let cfn;

  const requestContext = {
    principal: {
      isAdmin: true,
      status: 'active',
    },
    projectId: 'test-project',
    name: 'test-env-name',
  };
  const resolvedVars = {
    projectId: 'test-project',
  };
  const meta = { workflowId: `wf-provision-environment-sc` };
  const input = {
    envTypeId: 'test-env-type',
    envTypeConfigId: 'test-env-type-config',
    requestContext,
    resolvedVars,
    portfolioId: 'test-portfolio-id',
    productId: 'test-product-id',
  };
  let container;

  const step = new CheckLaunchDependency({
    step: { config: {} },
    workflowPayload: new WorkflowPayload({
      meta,
      input,
      container,
      workflowInstance: { steps: ['st-check-launch-dependency'] },
    }),
  });

  beforeAll(async () => {
    container = new ServicesContainer();
    container.register('aws', new AwsServiceMock());
    container.register('albService', new AlbServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('envTypeConfigService', new EnvTypeConfigServiceMock());
    container.register('envTypeService', new EnvTypeServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('pluginRegistryService', new PluginRegistryServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    albService = await container.find('albService');
    lockService = await container.find('lockService');
    envTypeConfigService = await container.find('envTypeConfigService');
    pluginRegistryService = await container.find('pluginRegistryService');

    step.payloadOrConfig = {
      string: stringInput => {
        return stringInput;
      },
      optionalString: stringInput => {
        return stringInput;
      },
      object: () => {
        return requestContext;
      },
      optionalBoolean: () => {
        return true;
      },
    };

    step.state = {
      setKey: jest.fn(),
      ...step.payloadOrConfig,
    };

    step.container = container;

    step.print = jest.fn();
    step.printError = jest.fn();
    step.payload.setKey = jest.fn();
    step.state.setKey = jest.fn();
  });

  beforeEach(async () => {
    cfn = {
      createStack: jest.fn(),
    };
    step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
    albService.findAwsAccountId = jest.fn(() => {
      return 'test-account-id';
    });
    envTypeConfigService.mustFind = jest.fn(() => {
      return { params: [] };
    });
    lockService.tryWriteLock = jest.fn(() => {
      return 'test-lock-id';
    });
    lockService.releaseWriteLock = jest.fn(() => {
      return true;
    });
    step.resolveVarExpressions = jest.fn(() => {
      return [];
    });
    step.describeArtifact = jest.fn(() => {
      return { artifactInfo: { TemplateUrl: 'sampleTemplateURL' } };
    });
    // Mock locking so that the putBucketPolicy actually gets called
    lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());
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
      step.getTemplateOutputs = jest.fn(() => {
        return { NeedsALB: { Value: true } };
      });
      await expect(step.start()).rejects.toThrow('project with id "test-project" does not exist');
    });

    it('should throw error obtaining lock fails', async () => {
      lockService.tryWriteLock.mockImplementationOnce(() => {
        return undefined;
      });
      await expect(step.start()).rejects.toThrow('Could not obtain a lock');
    });

    it('should call provisionAlb when template output has needsALB set to true', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: true },
        MaxCountALBDependentWorkspaces: { Description: 'Maximum ALB Count', Value: 2 },
      };
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      jest.spyOn(step, 'provisionAlb').mockImplementationOnce(() => {});
      await step.start();
      expect(step.provisionAlb).toHaveBeenCalled();
    });

    it('should not call provisionAlb when template output has needsALB set to false', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
        MaxCountALBDependentWorkspaces: { Description: 'Maximum ALB Count', Value: 2 },
      };
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      jest.spyOn(step, 'provisionAlb').mockImplementationOnce(() => {});
      await step.start();
      expect(step.provisionAlb).not.toHaveBeenCalled();
    });

    it('should set state and payload keys', async () => {
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: true },
        MaxCountALBDependentWorkspaces: { Description: 'Maximum ALB Count', Value: 2 },
      };
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      jest.spyOn(step, 'provisionAlb').mockImplementationOnce(() => {});
      await step.start();
      // CHECK
      expect(step.payload.setKey).toHaveBeenCalledWith('needsAlb', true);
      expect(step.state.setKey).toHaveBeenCalledWith('ALB_LOCK', 'test-lock-id');
    });
  });

  describe('provisionAlb', () => {
    it('should throw error when project is not valid', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        throw new Error('project with id "test-project" does not exist');
      });
      await expect(step.provisionAlb(requestContext, resolvedVars, 'test-project-id', [], 1)).rejects.toThrow(
        'project with id "test-project" does not exist',
      );
    });

    it('should throw error when count is greater than the maximum count', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        return 3;
      });
      await expect(step.provisionAlb(requestContext, resolvedVars, 'test-project-id', [], 1)).rejects.toThrow(
        'Error provisioning environment. Reason: Maximum workspaces using ALB has reached',
      );
    });

    it('should skip alb deployment when alb already exists', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        return 1;
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return true;
      });
      jest.spyOn(step, 'deployStack').mockImplementationOnce(() => {});
      await step.provisionAlb(requestContext, resolvedVars, 'test-project-id', [], 10);
      // CHECK
      expect(step.deployStack).not.toHaveBeenCalled();
    });

    it('should call alb deployment when alb does not exists', async () => {
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        return 1;
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return false;
      });
      jest.spyOn(step, 'deployStack').mockImplementationOnce(() => {});
      await step.provisionAlb(requestContext, resolvedVars, 'test-project-id', [], 10);
      // CHECK
      expect(step.deployStack).toHaveBeenCalled();
    });
  });

  describe('deployStack', () => {
    it('should throw error when project is not valid', async () => {
      jest.spyOn(step, 'getCloudFormationService').mockImplementationOnce(() => {
        throw new Error('project with id "test-project" does not exist');
      });
      await expect(step.deployStack(requestContext, resolvedVars, [])).rejects.toThrow(
        'project with id "test-project" does not exist',
      );
    });

    it('should call create stack and set stack id on success', async () => {
      cfn.createStack = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { StackId: 'test-stack-id' };
          },
        };
      });
      step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
      await step.provisionAlb(requestContext, resolvedVars, 'test-project-id', [], 10);
      // CHECK
      expect(cfn.createStack).toHaveBeenCalled();
      expect(step.state.setKey).toHaveBeenCalledWith('STACK_ID', 'test-stack-id');
    });

    it('should return resolved promise', async () => {
      cfn.createStack = jest.fn().mockImplementation(() => {
        return {
          promise: () => {
            return { StackId: 'test-stack-id' };
          },
        };
      });
      step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
      // OPERATE
      const response = await step.provisionAlb(requestContext, resolvedVars, 'test-project-id', [], 10);
      // CHECK
      expect(response).toMatchObject({
        waitDecision: {
          check: { methodName: 'shouldResumeWorkflow', params: '[]' },
          counter: 1200,
          max: 1200,
          otherwise: { methodName: 'reportTimeout', params: '[]' },
          seconds: 5,
          thenCall: { methodName: 'onSuccessfulCompletion', params: '[]' },
          type: 'wait',
        },
      });
    });
  });

  describe('handleStackCompletion', () => {
    it('should throw error when aws account id retrival fails', async () => {
      albService.findAwsAccountId.mockImplementationOnce(() => {
        throw new Error('project with id "test-project" does not exist');
      });

      step.getTemplateOutputs = jest.fn(() => {
        return { NeedsALB: true };
      });
      await expect(step.handleStackCompletion([])).rejects.toThrow('project with id "test-project" does not exist');
    });

    it('should update alb details with null if output does not exist', async () => {
      albService.findAwsAccountId.mockImplementationOnce(() => {
        return 'test-account-id';
      });
      jest.spyOn(albService, 'saveAlbDetails').mockImplementationOnce(() => {});
      const albDetails = {
        id: 'test-account-id',
        albStackName: 'STACK_ID',
        albArn: null,
        listenerArn: null,
        albDnsName: null,
        albHostedZoneId: null,
        albSecurityGroup: null,
        albDependentWorkspacesCount: 0,
      };
      await step.handleStackCompletion([]);
      expect(albService.saveAlbDetails).toHaveBeenCalledWith('test-account-id', albDetails);
    });

    it('should update alb details with output values for AppStream', async () => {
      albService.findAwsAccountId.mockImplementationOnce(() => {
        return 'test-account-id';
      });
      albService.getAlbHostedZoneId = jest.fn(() => {
        return 'albHostedZoneId';
      });
      jest.spyOn(albService, 'saveAlbDetails').mockImplementationOnce(() => {});
      const output = {
        LoadBalancerArn: 'test-alb-arn',
        ListenerArn: 'test-listener-arn',
        ALBDNSName: 'test-dns',
        ALBSecurityGroupId: 'test-sg',
        ALBHostedZoneId: 'albHostedZoneId',
      };
      const albDetails = {
        id: 'test-account-id',
        albStackName: 'STACK_ID',
        albArn: 'test-alb-arn',
        listenerArn: 'test-listener-arn',
        albDnsName: 'test-dns',
        albHostedZoneId: 'albHostedZoneId',
        albSecurityGroup: 'test-sg',
        albDependentWorkspacesCount: 0,
      };
      await step.handleStackCompletion(output);
      expect(albService.saveAlbDetails).toHaveBeenCalledWith('test-account-id', albDetails);
    });
    it('should update alb details with output values', async () => {
      albService.findAwsAccountId.mockImplementationOnce(() => {
        return 'test-account-id';
      });
      jest.spyOn(albService, 'saveAlbDetails').mockImplementationOnce(() => {});
      const output = {
        LoadBalancerArn: 'test-alb-arn',
        ListenerArn: 'test-listener-arn',
        ALBDNSName: 'test-dns',
        ALBSecurityGroupId: 'test-sg',
      };
      const albDetails = {
        id: 'test-account-id',
        albStackName: 'STACK_ID',
        albArn: 'test-alb-arn',
        listenerArn: 'test-listener-arn',
        albDnsName: 'test-dns',
        albHostedZoneId: null,
        albSecurityGroup: 'test-sg',
        albDependentWorkspacesCount: 0,
      };
      await step.handleStackCompletion(output);
      expect(albService.saveAlbDetails).toHaveBeenCalledWith('test-account-id', albDetails);
    });
  });

  describe('parseS3DetailsfromUrl', () => {
    it('should throw error when url is invlalid', async () => {
      await expect(step.parseS3DetailsfromUrl('https://invalid.example.com')).rejects.toThrow(
        'https://invalid.example.com',
      );
    });

    it('return bucket name and key on success', async () => {
      const { bucketName, key } = await step.parseS3DetailsfromUrl(
        'https://gitrstudiocft.s3.amazonaws.com/ec2-rlstudio.yaml',
      );
      expect(bucketName).toEqual('gitrstudiocft');
      expect(key).toEqual('ec2-rlstudio.yaml');
    });
  });

  describe('reportTimeout', () => {
    it('should throw error when called', async () => {
      await expect(step.reportTimeout()).rejects.toThrow(
        'Error provisioning environment "test-env-name".The workflow timed - out because the ALB provisioing stack "STACK_ID" did not complete within the timeout period of 20 minutes.',
      );
    });

    it('should release lock when alb is present', async () => {
      try {
        await step.reportTimeout();
      } catch (err) {
        // DO Nothing
      }
      expect(lockService.releaseWriteLock).toHaveBeenCalled();
    });
  });

  describe('onPass', () => {
    it('should release lock when alb is present', async () => {
      try {
        await step.onPass();
      } catch (err) {
        // DO Nothing
      }
      expect(lockService.releaseWriteLock).toHaveBeenCalled();
    });
  });

  describe('onFail', () => {
    it('should call print error function', async () => {
      await step.onFail('Error message');
      expect(step.printError).toHaveBeenCalledWith('Error message');
    });

    it('should release lock when alb is present', async () => {
      await step.onFail('Error message');
      expect(lockService.releaseWriteLock).toHaveBeenCalled();
    });

    it('should call visit plugins method', async () => {
      await step.onFail('Error message');
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalled();
    });
  });
});
