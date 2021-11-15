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

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-raas-services/lib/alb/alb-service');
const AlbServiceMock = require('@aws-ee/base-raas-services/lib/alb/alb-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');
const PluginRegistryServiceMock = require('@aws-ee/base-services/lib/plugin-registry/plugin-registry-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-cidr-service');
const EnvironmentScCidrServiceMock = require('@aws-ee/base-raas-services/lib/environment/service-catalog/environment-sc-cidr-service');

jest.mock('@aws-ee/base-raas-services/lib/environment/environment-dns-service');
const EnvironmentDnsServiceMock = require('@aws-ee/base-raas-services/lib/environment/environment-dns-service');

jest.mock('../../../../environment-type-mgmt-services/lib/environment-type/env-type-service.js');
const EnvTypeServiceMock = require('../../../../environment-type-mgmt-services/lib/environment-type/env-type-service.js');

const TerminateLaunchDependency = require('../terminate-launch-dependency/terminate-launch-dependency');

describe('TerminateLaunchDependencyStep', () => {
  let albService = null;
  let lockService = null;
  let environmentScService = null;
  let environmentDnsService = null;
  let pluginRegistryService = null;
  let environmentScCidrService = null;
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
    container.register('aws', new AwsServiceMock());
    container.register('albService', new AlbServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('environmentDnsService', new EnvironmentDnsServiceMock());
    container.register('pluginRegistryService', new PluginRegistryServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('envTypeService', new EnvTypeServiceMock());
    container.register('environmentScCidrService', new EnvironmentScCidrServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    albService = await container.find('albService');
    lockService = await container.find('lockService');
    environmentScService = await container.find('environmentScService');
    environmentDnsService = await container.find('environmentDnsService');
    pluginRegistryService = await container.find('pluginRegistryService');
    environmentScCidrService = await container.find('environmentScCidrService');

    step.describeArtifact = jest.fn(() => {
      return { artifactInfo: { TemplateUrl: 'sampleTemplateURL' } };
    });

    step.parseS3DetailsfromUrl = jest.fn(() => {
      return { bucketName: 'sampleBucketName', key: 'sampleKey' };
    });

    step.payloadOrConfig = {
      string: stringInput => {
        return stringInput;
      },
      object: () => {
        return requestContext;
      },
      optionalString: stringInput => {
        return stringInput;
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
    environmentScCidrService.revokeIngressRuleWithSecurityGroup = jest.fn();
  });

  beforeEach(async () => {
    cfn = {
      deleteStack: jest.fn(),
    };
    step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
    step.checkIfAppStreamEnabled = jest.fn(() => {
      return false;
    });
    albService.findAwsAccountId = jest.fn(() => {
      return 'test-account-id';
    });
    lockService.tryWriteLock = jest.fn(() => {
      return 'test-lock-id';
    });
    lockService.releaseWriteLock = jest.fn(() => {
      return true;
    });
    // Mock locking so that the fn() actually gets called
    lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());
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
        '{"id":"test-id","albStackName":null,"albArn":null,"listenerArn":null,"albDnsName":null,"albSecurityGroup":null,"albDependentWorkspacesCount":1}',
    };
    albService.getAlbDetails = jest.fn(() => {
      return albDetails;
    });
  });

  afterEach(() => {
    // Restore all the mocks created using spy to original function behaviour
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

    it('should not delete route53 record, security group and rule if type is not RstudioV2', async () => {
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
      expect(environmentScCidrService.revokeIngressRuleWithSecurityGroup).not.toHaveBeenCalled();
    });

    it('should call delete private route53 record if type is RstudioV2 and alb exists for AppStream', async () => {
      step.checkIfAppStreamEnabled = jest.fn(() => {
        return true;
      });
      const templateOutputs = {
        NeedsALB: { Description: 'Needs ALB', Value: false },
      };
      step.cfnOutputsArrayToObject = jest.fn().mockImplementationOnce(() => {
        return {
          MetaConnection1Type: 'rstudiov2',
          ListenerRuleARN: null,
        };
      });
      environmentScService.getMemberAccount = jest.fn().mockImplementationOnce(() => {
        return {
          route53HostedZone: 'sampleRoute53HostedZone',
        };
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return true;
      });
      albService.getAlbHostedZoneID = jest.fn();
      jest.spyOn(step, 'getTemplateOutputs').mockImplementationOnce(() => {
        return templateOutputs;
      });
      environmentDnsService.deletePrivateRecordForDNS = jest.fn();
      albService.checkAndTerminateAlb = jest.fn();
      await step.start();
      expect(environmentDnsService.deleteRecord).not.toHaveBeenCalled();
      expect(environmentDnsService.deletePrivateRecordForDNS).toHaveBeenCalled();
    });

    it('should call delete route53 record if type is RstudioV2 and alb exists', async () => {
      step.setting = { getBoolean: jest.fn(() => false) };
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

    it('should call revoke security group if type is RstudioV2 and alb exists', async () => {
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
      expect(environmentScCidrService.revokeIngressRuleWithSecurityGroup).toHaveBeenCalled();
    });

    it('should not call revoke security group if type is RstudioV2 and alb not exists', async () => {
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
      expect(environmentScCidrService.revokeIngressRuleWithSecurityGroup).not.toHaveBeenCalled();
    });
  });

  describe('checkAndTerminateAlb', () => {
    let origCheckPendingEnvWithSSLCertFn;
    beforeAll(() => {
      origCheckPendingEnvWithSSLCertFn = step.checkPendingEnvWithSSLCert;
      step.checkPendingEnvWithSSLCert = jest.fn(() => Promise.resolve(true));
    });
    afterAll(() => {
      step.checkPendingEnvWithSSLCert = origCheckPendingEnvWithSSLCertFn;
    });
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
      jest.clearAllMocks();
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

    it('should not call alb termination when there are pending env with SSL Cert', async () => {
      // BUILD
      albService.albDependentWorkspacesCount.mockImplementationOnce(() => {
        return 0;
      });
      albService.checkAlbExists.mockImplementationOnce(() => {
        return true;
      });
      step.checkPendingEnvWithSSLCert = jest.fn(() => Promise.resolve(true));

      jest.spyOn(step, 'terminateStack').mockImplementationOnce(() => {});

      // OPERATE
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
        step.terminateStack(requestContext, 'test-project-id', 'test-external-id', { albStackName: 'test-stack-id' }),
      ).rejects.toThrow('project with id "test-project" does not exist');
    });

    it('should call delete stack and set stack id on success', async () => {
      cfn.deleteStack = jest.fn().mockImplementation(() => {
        return {
          promise: () => {},
        };
      });
      step.getCloudFormationService = jest.fn().mockResolvedValue(cfn);
      await step.terminateStack(requestContext, 'test-project-id', 'test-external-id', {
        albStackName: 'test-stack-id',
      });
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
      const response = await step.terminateStack(requestContext, 'test-project-id', 'test-external-id', {
        albStackName: 'test-stack-id',
      });
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
        albSecurityGroup: null,
        albDependentWorkspacesCount: 0,
      };
      await step.onSuccessfulCompletion([]);
      expect(albService.saveAlbDetails).toHaveBeenCalledWith('test-account-id', albDetails);
    });
  });

  describe('reportTimeout', () => {
    it('should throw error when called', async () => {
      await expect(step.reportTimeout()).rejects.toThrow(
        'Error terminating environment "envName" with id "envId". The workflow timed-out because the ALB CFT did not terminate within the timeout period of 20 minutes.',
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
    it('should release lock when lock is present', async () => {
      await step.onPass();
      expect(lockService.releaseWriteLock).toHaveBeenCalled();
    });

    it('should not release lock when lock is not present', async () => {
      jest.spyOn(step.state, 'optionalString').mockImplementationOnce(() => {
        return '';
      });
      await step.onPass();
      expect(lockService.releaseWriteLock).not.toHaveBeenCalled();
    });
  });

  describe('onFail', () => {
    it('update ALB details to null if stack id present', async () => {
      await step.onFail({ message: 'Error Message' });
      const albDetails = {
        id: 'test-account-id',
        albStackName: null,
        albArn: null,
        listenerArn: null,
        albDnsName: null,
        albSecurityGroup: null,
        albDependentWorkspacesCount: 0,
      };
      expect(albService.saveAlbDetails).toHaveBeenCalledWith('test-account-id', albDetails);
    });

    it('should not update ALB details to null if stack id is not present', async () => {
      jest.spyOn(step.state, 'optionalString').mockImplementationOnce(() => {
        return '';
      });
      try {
        await step.onFail({ message: 'Error Message' });
      } catch (err) {
        // DO NOTHING
      }
      expect(albService.saveAlbDetails).not.toHaveBeenCalled();
    });

    it('Should release lock if lock exists', async () => {
      await step.onFail({ message: 'Error Message' });
      expect(lockService.releaseWriteLock).toHaveBeenCalled();
    });

    it('should call visit plugins method', async () => {
      await step.onFail({ message: 'Error Message' });
      expect(pluginRegistryService.visitPlugins).toHaveBeenCalled();
    });
  });

  describe('checkPendingEnvWithSSLCert', () => {
    it('should return false since there are no pending environment', async () => {
      // BUILD
      const envScService = {};
      envScService.list = jest.fn(() => Promise.resolve([]));

      const envTypeService = {};
      envTypeService.mustFind = jest.fn(() => Promise.resolve({}));

      // OPERATE, CHECK
      await expect(step.checkPendingEnvWithSSLCert(envScService, envTypeService, requestContext)).resolves.toEqual(
        false,
      );
    });

    it('should return false since there are NO pending environment with SSL cert', async () => {
      // BUILD
      const envScService = {};
      envScService.list = jest.fn(() =>
        Promise.resolve([
          {
            id: 'abc',
            rev: 0,
            projectId: 'proj-123',
            inWorkflow: 'true',
            status: 'PENDING',
            createdAt: '2021-11-11T05:47:39.178Z',
            cidr: '0.0.0.0/0',
            updatedBy: 'u-zBpBkLuXjdDbdUAHalfY7',
            createdBy: 'u-zBpBkLuXjdDbdUAHalfY7',
            name: 'rstudio-6',
            studyIds: [],
            updatedAt: '2021-11-11T05:47:39.178Z',
            indexId: 'index-123',
            description: 'RStudio service workspace',
            envTypeConfigId: 'config-1',
            envTypeId: 'prod-xyz',
          },
        ]),
      );

      const envTypeService = {};
      envTypeService.mustFind = jest.fn(() =>
        Promise.resolve({
          id: 'prod-xyz',
          product: {
            productId: 'prod-n52qqfqv6bmya',
          },
          rev: 1,
          status: 'approved',
          createdAt: '2021-11-09T18:06:56.944Z',
          updatedBy: 'u-zBpBkLuXjdDbdUAHalfY7',
          createdBy: 'u-zBpBkLuXjdDbdUAHalfY7',
          name: 'Sample Workspace Type',
          desc: '',
          provisioningArtifact: {
            id: 'pa-7udayuv3syfo6',
          },
          params: [
            {
              IsNoEcho: false,
              ParameterConstraints: {
                AllowedValues: [],
              },
              ParameterType: 'String',
              Description: 'The ARN of the KMS encryption Key used to encrypt data in the instance',
              ParameterKey: 'EncryptionKeyArn',
            },
          ],
        }),
      );

      // OPERATE, CHECK
      await expect(step.checkPendingEnvWithSSLCert(envScService, envTypeService, requestContext)).resolves.toEqual(
        false,
      );
    });

    it('should return true since there are pending environment with SSL cert', async () => {
      // BUILD
      const envScService = {};
      envScService.list = jest.fn(() =>
        Promise.resolve([
          {
            id: 'abc',
            rev: 0,
            projectId: 'proj-123',
            inWorkflow: 'true',
            status: 'PENDING',
            createdAt: '2021-11-11T05:47:39.178Z',
            cidr: '0.0.0.0/32',
            updatedBy: 'u-zBpBkLuXjdDbdUAHalfY7',
            createdBy: 'u-zBpBkLuXjdDbdUAHalfY7',
            name: 'rstudio-6',
            studyIds: [],
            updatedAt: '2021-11-11T05:47:39.178Z',
            indexId: 'index-123',
            description: 'RStudio service workspace',
            envTypeConfigId: 'config-1',
            envTypeId: 'prod-xyz',
          },
        ]),
      );

      const envTypeService = {};
      envTypeService.mustFind = jest.fn(() =>
        Promise.resolve({
          id: 'prod-xyz',
          product: {
            productId: 'prod-n52qqfqv6bmya',
          },
          rev: 1,
          status: 'approved',
          createdAt: '2021-11-09T18:06:56.944Z',
          updatedBy: 'u-zBpBkLuXjdDbdUAHalfY7',
          createdBy: 'u-zBpBkLuXjdDbdUAHalfY7',
          name: 'Sample Workspace Type',
          desc: '',
          provisioningArtifact: {
            id: 'pa-7udayuv3syfo6',
          },
          params: [
            {
              IsNoEcho: false,
              ParameterConstraints: {
                AllowedValues: [],
              },
              ParameterType: 'String',
              Description: 'The ARN of the AWS Certificate Manager SSL Certificate to associate with the Load Balancer',
              ParameterKey: 'ACMSSLCertARN',
            },
          ],
        }),
      );

      // OPERATE, CHECK
      await expect(step.checkPendingEnvWithSSLCert(envScService, envTypeService, requestContext)).resolves.toEqual(
        true,
      );
    });
  });
});
