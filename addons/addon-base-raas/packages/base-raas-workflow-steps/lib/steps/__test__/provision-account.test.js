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
const AWSMock = require('aws-sdk-mock');
const WorkflowPayload = require('@aws-ee/workflow-engine/lib/workflow-payload');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const SettingsService = require('@aws-ee/base-services/lib/settings/env-settings-service');
// const AccountService = require('@aws-ee/base-raas-services/lib/account/account-service');
const ProvisionAccount = require('../provision-account/provision-account');

describe('ProvisionAccount', () => {
  const requestContext = { principalIdentifier: { uid: 'u-daffyduck' } };

  const meta = { workflowId: `wf-provision-account` };
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
    step = new ProvisionAccount({
      step: { config: {} },
      stepReporter: reporter,
      workflowPayload: new WorkflowPayload({
        meta,
        input,
        workflowInstance: { steps: ['st-provision-account'] },
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
  });
  afterEach(() => {
    AWSMock.restore();
  });

  describe('saveAccountToDb', () => {
    beforeEach(() => {
      const accountService = {
        saveAccountToDb: jest.fn(),
      };
      accountService.saveAccountToDb = jest.fn();
      step.mustFindServices = jest.fn().mockImplementation(async services => {
        if (services[0] === 'accountService') {
          return Promise.resolve([accountService]);
        }
        return null;
      });

      const describeAccount = jest.fn().mockReturnValue({
        promise: jest.fn().mockReturnValue({
          Account: {
            Arn: 'abc123',
          },
        }),
      });
      const organization = {
        describeAccount,
      };
      step.getOrganizationService = jest.fn().mockReturnValue(organization);

      step.state = {
        setKey: jest.fn(),
        ...step.payload,
      };
    });

    it('AppStream: false', async () => {
      step.settings = {
        get: key => {
          if (key === 'isAppStreamEnabled') {
            return 'false';
          }
          throw new Error('Unexpected key');
        },
      };
      const response = await step.saveAccountToDb();
      expect(response).toMatchObject({
        waitDecision: {
          seconds: 300,
          thenCall: { methodName: 'deployStack', params: '[]' },
          type: 'wait',
        },
      });
    });

    it('AppStream: true', async () => {
      step.settings = {
        get: key => {
          if (key === 'isAppStreamEnabled') {
            return 'true';
          }
          throw new Error('Unexpected key');
        },
      };
      const response = await step.saveAccountToDb();
      expect(response).toMatchObject({
        waitDecision: {
          seconds: 300,
          thenCall: { methodName: 'shareImageWithMemberAccount', params: '[]' },
          type: 'wait',
        },
      });
    });
  });

  describe('deployStack', () => {
    beforeEach(() => {
      const userService = {
        mustFindUser: jest.fn().mockReturnValue({ username: 'john' }),
      };
      const cfnTemplateService = {
        getTemplate: jest.fn().mockReturnValue(''),
      };
      step.mustFindServices = jest.fn().mockImplementation(async services => {
        if (services[0] === 'userService') {
          return Promise.resolve([userService]);
        }
        if (services[0] === 'cfnTemplateService') {
          return Promise.resolve([cfnTemplateService]);
        }
        return null;
      });

      const createStack = jest.fn().mockReturnValue({
        promise: jest.fn().mockReturnValue({
          StackId: 'stack-123',
        }),
      });
      const cfn = {
        createStack,
      };
      step.getCloudFormationService = jest.fn().mockReturnValue(cfn);
    });
    it('AppStream: false', async () => {
      step.settings = {
        get: key => {
          if (key === 'isAppStreamEnabled') {
            return 'false';
          }
          if (key === 'launchConstraintRolePrefix') {
            return '*';
          }
          if (key === 'launchConstraintPolicyPrefix') {
            return '*';
          }
          throw new Error('Unexpected key');
        },
      };
      step.payload = {
        string: stringInput => {
          return stringInput;
        },
        optionalString: (stringInput, defaultStr) => {
          // If AppStream is NOT enabled payload will be empty for all AppStream fields
          // Some AppStream params require a default value and cannot be empty, which is why we
          // set to return defaultStr if that value is provided
          if (defaultStr) {
            return defaultStr;
          }
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
      step.updateAccount = jest.fn;
      const response = await step.deployStack();
      expect(response).toMatchObject({
        waitDecision: {
          seconds: 20,
          check: { methodName: 'checkCfnCompleted', params: '[]' },
          max: 120,
          type: 'wait',
        },
      });
    });

    it('AppStream: true', async () => {
      step.settings = {
        get: key => {
          if (key === 'isAppStreamEnabled') {
            return 'true';
          }
          if (key === 'launchConstraintRolePrefix') {
            return '*';
          }
          if (key === 'launchConstraintPolicyPrefix') {
            return '*';
          }
          throw new Error('Unexpected key');
        },
      };
      step.payload = {
        string: stringInput => {
          return stringInput;
        },
        // If AppStream is enabled, payload will contain all fields
        optionalString: stringInput => {
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
      step.updateAccount = jest.fn;
      const response = await step.deployStack();
      expect(response).toMatchObject({
        waitDecision: {
          seconds: 20,
          check: { methodName: 'checkCfnCompleted', params: '[]' },
          max: 120,
          type: 'wait',
        },
      });
    });
  });

  describe('checkCfnCompleted', () => {
    it('AppStream: true', async () => {
      step.settings = {
        get: key => {
          if (key === 'isAppStreamEnabled') {
            return 'true';
          }
          throw new Error('Unexpected key');
        },
      };
      const describeStacks = jest.fn().mockReturnValue({
        promise: jest.fn().mockReturnValue({
          Stacks: [
            {
              StackStatus: 'CREATE_COMPLETE',
              Outputs: [
                { OutputKey: 'VPC', OutputValue: 'vpc-123' },
                { OutputKey: 'PrivateWorkspaceSubnet', OutputValue: 'appStr-subnet-1' },
                { OutputKey: 'CrossAccountExecutionRoleArn', OutputValue: 'execution-role-arn-1' },
                { OutputKey: 'CrossAccountEnvMgmtRoleArn', OutputValue: 'env-mgmt-role-arn-1' },
                { OutputKey: 'EncryptionKeyArn', OutputValue: 'encryption-key-arn-1' },
                { OutputKey: 'AppStreamStackName', OutputValue: 'appStr-stack-1' },
                { OutputKey: 'AppStreamSecurityGroup', OutputValue: 'appStr-sg-1' },
                { OutputKey: 'AppStreamFleet', OutputValue: 'appStr-fl-1' },
              ],
            },
          ],
        }),
      });
      const cfn = {
        describeStacks,
      };
      step.getCloudFormationService = jest.fn().mockReturnValue(cfn);

      step.state = {
        setKey: jest.fn(),
        ...step.payload,
      };
      step.updateLocalResourcePolicies = jest.fn();
      step.updateAccount = jest.fn();
      step.addAwsAccountTable = jest.fn();
      step.startAppStreamFleet = jest.fn();
      step.checkAppStreamFleetIsRunning = jest.fn().mockReturnValue(true);
      await expect(step.checkCfnCompleted()).resolves.toEqual(true);

      expect(step.startAppStreamFleet).toHaveBeenCalled();
      expect(step.checkAppStreamFleetIsRunning).toHaveBeenCalled();
      expect(step.updateAccount).toHaveBeenCalledWith({
        status: 'COMPLETED',
        cfnInfo: {
          crossAccountEnvMgmtRoleArn: 'env-mgmt-role-arn-1',
          crossAccountExecutionRoleArn: 'execution-role-arn-1',
          encryptionKeyArn: 'encryption-key-arn-1',
          stackId: 'STATE_STACK_ID',
          subnetId: 'appStr-subnet-1',
          vpcId: 'vpc-123',
        },
      });
      expect(step.addAwsAccountTable).toHaveBeenCalledWith(
        { principalIdentifier: { uid: 'u-daffyduck' } },
        {
          accountId: 'ACCOUNT_ID',
          description: 'description',
          externalId: 'externalId',
          name: 'accountName',
          roleArn: 'execution-role-arn-1',
          xAccEnvMgmtRoleArn: 'env-mgmt-role-arn-1',
          vpcId: 'vpc-123',
          encryptionKeyArn: 'encryption-key-arn-1',
          appStreamStackName: 'appStr-stack-1',
          appStreamSecurityGroupId: 'appStr-sg-1',
          appStreamFleetName: 'appStr-fl-1',
          subnetId: 'appStr-subnet-1',
        },
      );
    });
  });

  it('AppStream: false', async () => {
    step.settings = {
      get: key => {
        if (key === 'isAppStreamEnabled') {
          return 'false';
        }
        throw new Error('Unexpected key');
      },
    };
    const describeStacks = jest.fn().mockReturnValue({
      promise: jest.fn().mockReturnValue({
        Stacks: [
          {
            StackStatus: 'CREATE_COMPLETE',
            Outputs: [
              { OutputKey: 'VPC', OutputValue: 'vpc-123' },
              { OutputKey: 'VpcPublicSubnet1', OutputValue: 'public-subnet-1' },
              { OutputKey: 'CrossAccountExecutionRoleArn', OutputValue: 'execution-role-arn-1' },
              { OutputKey: 'CrossAccountEnvMgmtRoleArn', OutputValue: 'env-mgmt-role-arn-1' },
              { OutputKey: 'EncryptionKeyArn', OutputValue: 'encryption-key-arn-1' },
            ],
          },
        ],
      }),
    });
    const cfn = {
      describeStacks,
    };
    step.getCloudFormationService = jest.fn().mockReturnValue(cfn);

    step.state = {
      setKey: jest.fn(),
      ...step.payload,
    };
    step.updateLocalResourcePolicies = jest.fn();
    step.updateAccount = jest.fn();
    step.addAwsAccountTable = jest.fn();
    await expect(step.checkCfnCompleted()).resolves.toEqual(true);

    expect(step.updateAccount).toHaveBeenCalledWith({
      status: 'COMPLETED',
      cfnInfo: {
        crossAccountEnvMgmtRoleArn: 'env-mgmt-role-arn-1',
        crossAccountExecutionRoleArn: 'execution-role-arn-1',
        encryptionKeyArn: 'encryption-key-arn-1',
        stackId: 'STATE_STACK_ID',
        subnetId: 'public-subnet-1',
        vpcId: 'vpc-123',
      },
    });
    expect(step.addAwsAccountTable).toHaveBeenCalledWith(
      { principalIdentifier: { uid: 'u-daffyduck' } },
      {
        accountId: 'ACCOUNT_ID',
        description: 'description',
        externalId: 'externalId',
        name: 'accountName',
        roleArn: 'execution-role-arn-1',
        xAccEnvMgmtRoleArn: 'env-mgmt-role-arn-1',
        vpcId: 'vpc-123',
        encryptionKeyArn: 'encryption-key-arn-1',
        subnetId: 'public-subnet-1',
      },
    );
  });
});
