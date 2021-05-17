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

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const AWSMock = require('aws-sdk-mock');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
const CreateNetworkInfrastructure = require('../storage-gateway/create-network-infrastructure');

describe('CreateNetworkInfra', () => {
  const requestContext = { principalIdentifier: { uid: 'u-daffyduck' } };

  const meta = { workflowId: `wf-create-network-infrastructure` };
  const input = {
    requestContext,
  };

  const reporter = jest.fn();
  reporter.print = jest.fn();

  let container;
  let step;

  beforeAll(async () => {
    container = new ServicesContainer();
    const settingsService = new SettingsService();
    settingsService.get = jest.fn(key => {
      if (key === 'customUserAgent') {
        return 'AwsLabs/SO0144/X.Y.Z';
      }
      throw new Error('Unexpected key');
    });

    container.register('settings', settingsService);
    container.register('aws', new AwsService());
    await container.initServices();
  });

  beforeEach(async () => {
    step = new CreateNetworkInfrastructure({
      step: { config: {} },
      stepReporter: reporter,
      workflowPayload: new WorkflowPayload({
        meta,
        input,
        workflowInstance: { steps: ['create-network-infrastructure'] },
      }),
    });

    step.payload = {
      string: stringInput => {
        return stringInput;
      },
      object: () => {
        return requestContext;
      },
    };

    const awsService = await container.find('aws');
    AWSMock.setSDKInstance(awsService.sdk);
    step.getAWS = jest.fn(function() {
      return awsService;
    });
    step.createNetworkInfra = jest.fn();
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('start', () => {
    it('should start', async () => {
      const ssmParameter = { Name: '/aws/service/storagegateway/ami/FILE_S3/latest' };
      const ssmParamValue = {
        Parameter: {
          Name: '/aws/service/storagegateway/ami/FILE_S3/latest',
          Type: 'String',
          Value: 'ami-099415e970e96839e',
        },
      };
      AWSMock.mock('SSM', 'getParameter', (params, callback) => {
        expect(params).toMatchObject(ssmParameter);
        callback(null, ssmParamValue);
      });
      step.state = {
        setKey: jest.fn(),
        ...step.payload,
      };
      const response = await step.start();
      expect(step.state.setKey).toHaveBeenCalledWith('STORAGE_GATEWAY_AMI', ssmParamValue.Parameter.Value);
      expect(step.state.setKey).toHaveBeenCalledWith('STATE_REQUEST_CONTEXT', requestContext);
      expect(step.createNetworkInfra).toHaveBeenCalledTimes(1);
      expect(response).toMatchObject({
        waitDecision: {
          check: { methodName: 'checkCfnCompleted', params: '[]' },
          counter: 60,
          max: 60,
          otherwise: undefined,
          seconds: 20,
          thenCall: { methodName: 'createStorageGateway', params: '[]' },
          type: 'wait',
        },
      });
    });
  });

  describe('createStorageGateway', () => {
    it('should call validate and addToCache', async () => {
      step.activateGateway = jest.fn();
      const response = await step.createStorageGateway();
      expect(step.activateGateway).toHaveBeenCalledTimes(1);
      expect(response).toMatchObject({
        waitDecision: {
          check: { methodName: 'validateGateway', params: '[]' },
          counter: 5,
          max: 5,
          otherwise: undefined,
          seconds: 5,
          thenCall: { methodName: 'addCacheToGateway', params: '[]' },
          type: 'wait',
        },
      });
    });
  });

  describe('activateGateway', () => {
    it('activate successful', async () => {
      const activateGatewayMockFn = jest.fn().mockImplementationOnce(() => 'gateway-1234');
      const getStorageGatewayMock = {};
      getStorageGatewayMock.activateGateway = activateGatewayMockFn;
      step.getStorageGateway = jest.fn().mockImplementationOnce(() => getStorageGatewayMock);
      step.state = {
        string: jest.fn(),
        setKey: jest.fn(),
      };
      const activateGatewayInput = {
        publicIp: '11.11.11.11',
        region: 'us-west-2',
        securityGroup: 'sg-1234567',
        timezone: 'GMT',
      };
      step.state.string.mockImplementation(param => {
        switch (param) {
          case 'PUBLIC_IP': {
            return activateGatewayInput.publicIp;
          }
          case 'REGION_ID': {
            return activateGatewayInput.region;
          }
          case 'SECURITY_GROUP': {
            return activateGatewayInput.securityGroup;
          }
          default:
            throw Error('Invalid key');
        }
      });
      await step.activateGateway();
      expect(step.state.string).toHaveBeenCalledWith('PUBLIC_IP');
      expect(step.state.string).toHaveBeenCalledWith('REGION_ID');
      expect(step.state.string).toHaveBeenCalledWith('SECURITY_GROUP');
      expect(step.state.setKey).toHaveBeenCalledWith('GATEWAY_ARN', 'gateway-1234');
      expect(getStorageGatewayMock.activateGateway).toHaveBeenCalledWith(requestContext, activateGatewayInput);
    });
  });

  describe('addCacheToGateway', () => {
    it('add cache and records to ddb', async () => {
      const addCacheToGatewayMockFn = jest.fn();
      const saveToDDBMockFn = jest.fn();
      const getStorageGatewayMock = {};
      getStorageGatewayMock.addCacheToGateway = addCacheToGatewayMockFn;
      getStorageGatewayMock.saveToDDB = saveToDDBMockFn;
      step.getStorageGateway = jest.fn().mockImplementationOnce(() => getStorageGatewayMock);
      step.state = {
        string: jest.fn(),
      };
      const addToCacheInput = {
        gatewayARN: 'gateway-1234',
        volumeId: 'volume-1234567',
      };
      const ddbInput = {
        vpcId: 'vpc-1212312313',
        subnetId: 'subnet-124324556',
        ec2Instance: 'instance-12345678',
        elasticIP: '11.11.11.11',
        securityGroup: 'sg-1234567',
        ec2RoleARN: 'arn:aws:iam:us-west-2:111111111111:role/gateway-role',
        volumeIds: [addToCacheInput.volumeId],
        cfnStackId: 'arn:aws:cloudformation:us-east-2:123456789012:stack/mystack/newstack123',
      };
      step.state.string.mockImplementation(param => {
        switch (param) {
          case 'PUBLIC_IP': {
            return ddbInput.elasticIP;
          }
          case 'SUBNET_ID': {
            return ddbInput.subnetId;
          }
          case 'SECURITY_GROUP': {
            return ddbInput.securityGroup;
          }
          case 'VPC_ID': {
            return ddbInput.vpcId;
          }
          case 'EC2_INSTANCE_ID': {
            return ddbInput.ec2Instance;
          }
          case 'IAM_ROLE_ARN': {
            return ddbInput.ec2RoleARN;
          }
          case 'GATEWAY_ARN': {
            return addToCacheInput.gatewayARN;
          }
          case 'VOLUME_ID': {
            return addToCacheInput.volumeId;
          }
          case 'STATE_STACK_ID': {
            return ddbInput.cfnStackId;
          }
          default:
            throw Error('Invalid key');
        }
      });
      await step.addCacheToGateway();
      expect(getStorageGatewayMock.addCacheToGateway).toHaveBeenCalledWith(requestContext, addToCacheInput);
      expect(getStorageGatewayMock.saveToDDB).toHaveBeenCalledWith(
        requestContext,
        ddbInput,
        addToCacheInput.gatewayARN,
      );
    });
  });

  describe('validateGateway', () => {
    it('validation successful', async () => {
      const listLocalDisksMockFn = jest.fn();
      const getStorageGatewayMock = {};
      getStorageGatewayMock.listLocalDisks = listLocalDisksMockFn;
      step.getStorageGateway = jest.fn().mockImplementationOnce(() => getStorageGatewayMock);
      step.state = {
        string: jest.fn(),
      };
      step.state.string.mockImplementationOnce(param => {
        if (param === 'GATEWAY_ARN') {
          return 'gateway-1234';
        }
        throw Error('Key not found');
      });
      const valid = await step.validateGateway();
      expect(step.state.string).toHaveBeenCalledWith('GATEWAY_ARN');
      expect(getStorageGatewayMock.listLocalDisks).toHaveBeenCalledWith(requestContext, 'gateway-1234');
      expect(valid).toEqual(true);
    });

    it('validation failed', async () => {
      const listLocalDisksMockFn = jest.fn().mockImplementation(() => {
        throw new Error('Gateway not found');
      });
      const getStorageGatewayMock = {};
      getStorageGatewayMock.listLocalDisks = listLocalDisksMockFn;
      step.getStorageGateway = jest.fn().mockImplementationOnce(() => getStorageGatewayMock);
      step.state = {
        string: jest.fn(),
      };
      step.state.string.mockImplementationOnce(param => {
        if (param === 'GATEWAY_ARN') {
          return 'gateway-1234';
        }
        throw Error('Key not found');
      });
      const valid = await step.validateGateway();
      expect(step.state.string).toHaveBeenCalledWith('GATEWAY_ARN');
      expect(getStorageGatewayMock.listLocalDisks).toHaveBeenCalledWith(requestContext, 'gateway-1234');
      expect(valid).toEqual(false);
    });
  });

  describe('onFail', () => {
    it('successful rollback', async () => {
      let deleteStackCalled = false;
      const stackIdParam = { StackName: 'storage-gateway-stack' };
      const stackDesc = {
        Stacks: [
          {
            StackStatus: 'CREATE_FAILED',
            StackStatusReason: 'VPC limit exceeded',
          },
        ],
      };
      AWSMock.mock('CloudFormation', 'describeStacks', (params, callback) => {
        expect(params).toMatchObject(stackIdParam);
        callback(null, stackDesc);
      });
      AWSMock.mock('CloudFormation', 'deleteStack', (params, callback) => {
        deleteStackCalled = true;
        expect(params).toMatchObject(stackIdParam);
        callback(null, null);
      });
      const deleteGatewayMockFn = jest.fn();
      const getStorageGatewayMock = {};
      getStorageGatewayMock.deleteGateway = deleteGatewayMockFn;
      step.getStorageGateway = jest.fn().mockImplementationOnce(() => getStorageGatewayMock);
      step.state = {
        setKey: jest.fn(),
        string: jest.fn(),
        optionalString: jest.fn(),
      };
      step.state.string.mockImplementationOnce(param => {
        if (param === 'STATE_STACK_ID') {
          return 'storage-gateway-stack';
        }
        throw Error('Key not found');
      });
      step.state.optionalString.mockImplementationOnce(param => {
        if (param === 'GATEWAY_ARN') {
          return 'gateway-1234';
        }
        throw Error('Key not found');
      });
      await step.onFail();
      expect(step.state.string).toHaveBeenCalledWith('STATE_STACK_ID');
      expect(step.state.optionalString).toHaveBeenCalledWith('GATEWAY_ARN');
      expect(getStorageGatewayMock.deleteGateway).toHaveBeenCalledWith(requestContext, 'gateway-1234');
      expect(deleteStackCalled).toEqual(true);
    });

    it('onFail when cloudformation delete fails', async () => {
      const stackIdParam = { StackName: 'storage-gateway-stack' };
      const stackDesc = {
        Stacks: [
          {
            StackStatus: 'CREATE_FAILED',
            StackStatusReason: 'VPC limit exceeded',
          },
        ],
      };
      let deleteStackCalled = false;
      AWSMock.mock('CloudFormation', 'describeStacks', (params, callback) => {
        expect(params).toMatchObject(stackIdParam);
        callback(null, stackDesc);
      });
      AWSMock.mock('CloudFormation', 'deleteStack', (params, callback) => {
        expect(params).toMatchObject(stackIdParam);
        deleteStackCalled = true;
        callback({ code: 'CannotDelete' }, null);
      });
      const deleteGatewayMockFn = jest.fn();
      const getStorageGatewayMock = {};
      getStorageGatewayMock.deleteGateway = deleteGatewayMockFn;
      step.getStorageGateway = jest.fn().mockImplementationOnce(() => getStorageGatewayMock);
      step.state = {
        setKey: jest.fn(),
        string: jest.fn(),
        optionalString: jest.fn(),
      };
      step.state.string.mockImplementationOnce(param => {
        if (param === 'STATE_STACK_ID') {
          return 'storage-gateway-stack';
        }
        throw Error('Key not found');
      });
      step.state.optionalString.mockImplementationOnce(param => {
        if (param === 'GATEWAY_ARN') {
          return 'gateway-1234';
        }
        throw Error('Key not found');
      });
      try {
        await step.onFail();
        expect.fail('Expected fail to throw error');
      } catch (error) {
        expect(step.state.string).toHaveBeenCalledWith('STATE_STACK_ID');
        expect(step.state.optionalString).toHaveBeenCalledWith('GATEWAY_ARN');
        // ensure that delete gateway was still called
        expect(getStorageGatewayMock.deleteGateway).toHaveBeenCalledWith(requestContext, 'gateway-1234');
        expect(deleteStackCalled).toEqual(true);
      }
    });
  });

  describe('checkCfnCompleted', () => {
    it('stack creation failed', async () => {
      const stackIdParam = { StackName: 'storage-gateway-stack' };
      const stackDesc = {
        Stacks: [
          {
            StackStatus: 'CREATE_FAILED',
            StackStatusReason: 'VPC limit exceeded',
          },
        ],
      };
      AWSMock.mock('CloudFormation', 'describeStacks', (params, callback) => {
        expect(params).toMatchObject(stackIdParam);
        callback(null, stackDesc);
      });
      step.state = {
        setKey: jest.fn(),
        string: jest.fn(),
      };
      step.state.string.mockImplementationOnce(() => 'storage-gateway-stack');
      try {
        await step.checkCfnCompleted();
        expect.fail('Expected to throw stack operation failed error');
      } catch (error) {
        expect(error.message).toEqual('Stack operation failed with message: VPC limit exceeded');
      }
    });

    it('stack creation in progress', async () => {
      const stackIdParam = { StackName: 'storage-gateway-stack' };
      const stackDesc = {
        Stacks: [
          {
            StackStatus: 'IN_PROGRESS',
          },
        ],
      };
      AWSMock.mock('CloudFormation', 'describeStacks', (params, callback) => {
        expect(params).toMatchObject(stackIdParam);
        callback(null, stackDesc);
      });
      step.state = {
        setKey: jest.fn(),
        string: jest.fn(),
      };
      step.state.string.mockImplementationOnce(() => 'storage-gateway-stack');
      const status = await step.checkCfnCompleted();
      expect(status).toEqual(false);
    });

    it('stack deleted', async () => {
      const stackIdParam = { StackName: 'storage-gateway-stack' };
      const stackDesc = {
        Stacks: [
          {
            StackStatus: 'DELETE_COMPLETE',
          },
        ],
      };
      AWSMock.mock('CloudFormation', 'describeStacks', (params, callback) => {
        expect(params).toMatchObject(stackIdParam);
        callback(null, stackDesc);
      });
      step.state = {
        setKey: jest.fn(),
        string: jest.fn(),
      };
      step.state.string.mockImplementationOnce(() => 'storage-gateway-stack');
      try {
        await step.checkCfnCompleted();
        expect.fail('Expected to throw stack deleted error');
      } catch (error) {
        expect(error.message).toEqual('Stack deleted');
      }
    });

    it('stack creation complete', async () => {
      const stackIdParam = { StackName: 'storage-gateway-stack' };
      const cfnToEnvKeys = {
        CacheVolume: 'VOLUME_ID',
        Region: 'REGION_ID',
        ElasticIP: 'PUBLIC_IP',
        SecurityGroup: 'SECURITY_GROUP',
        VpcPublicSubnet1: 'SUBNET_ID',
        VPC: 'VPC_ID',
        EC2RoleArn: 'IAM_ROLE_ARN',
        EC2Instance: 'EC2_INSTANCE_ID',
      };
      const stackDesc = {
        Stacks: [
          {
            StackStatus: 'CREATE_COMPLETE',
            Outputs: [
              {
                OutputKey: 'CacheVolume',
                OutputValue: 'volume-1234',
              },
              {
                OutputKey: 'Region',
                OutputValue: 'us-west-2',
              },
              {
                OutputKey: 'ElasticIP',
                OutputValue: '11.11.11.11',
              },
              {
                OutputKey: 'SecurityGroup',
                OutputValue: 'sg-123456',
              },
              {
                OutputKey: 'VpcPublicSubnet1',
                OutputValue: 'subnet-12345678',
              },
              {
                OutputKey: 'VPC',
                OutputValue: 'vpc-12345678',
              },
              {
                OutputKey: 'EC2RoleArn',
                OutputValue: 'arn:aws:iam:us-west-2:111111111111:role/gateway-role',
              },
              {
                OutputKey: 'EC2Instance',
                OutputValue: 'instance-121245',
              },
            ],
          },
        ],
      };
      AWSMock.mock('CloudFormation', 'describeStacks', (params, callback) => {
        expect(params).toMatchObject(stackIdParam);
        callback(null, stackDesc);
      });
      step.state = {
        setKey: jest.fn(),
        string: jest.fn(),
      };
      step.state.string.mockImplementationOnce(() => 'storage-gateway-stack');
      const status = await step.checkCfnCompleted();
      expect(status).toEqual(true);
      stackDesc.Stacks[0].Outputs.forEach(option => {
        expect(step.state.setKey).toHaveBeenCalledWith(cfnToEnvKeys[option.OutputKey], option.OutputValue);
      });
    });
  });
});
