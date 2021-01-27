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
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
// const AWSMock = require('aws-sdk-mock');
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/authorization/authorization-service');
const AuthServiceMock = require('@aws-ee/base-services/lib/authorization/authorization-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('../../environment-authz-service.js');
const EnvironmentAuthZServiceMock = require('../../environment-authz-service.js');

jest.mock('../../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');
const WorkflowTriggerServiceMock = require('../../../../../../../addon-base-workflow/packages/base-workflow-core/lib/workflow/workflow-trigger-service');

jest.mock('../environment-sc-service');
const EnvironmentScService = require('../environment-sc-service');

const EnvironmentScCidrService = require('../environment-sc-cidr-service');

describe('EnvironmentScCidrService', () => {
  let service = null;
  let environmentScService = null;
  let lockService = null;

  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('log', new Logger());
    container.register('lockService', new LockServiceMock());
    container.register('aws', new AwsService());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('authorizationService', new AuthServiceMock());
    container.register('environmentAuthzService', new EnvironmentAuthZServiceMock());
    container.register('workflowTriggerService', new WorkflowTriggerServiceMock());
    container.register('environmentScService', new EnvironmentScService());
    container.register('environmentScCidrService', new EnvironmentScCidrService());
    await container.initServices();

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();

    // Get instance of the service we are testing
    service = await container.find('environmentScCidrService');
    lockService = await container.find('lockService');
    environmentScService = await container.find('environmentScService');

    // Skip authorization by default
    service.assertAuthorized = jest.fn();

    lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());

    service._fromRawToDbObject = jest.fn(x => x);
  });

  describe('checkRequest', () => {
    it('should fail because the updateRequest is undefined', async () => {
      // BUILD
      const params = {
        id: 'testId',
        updateRequest: undefined,
      };

      // OPERATE
      try {
        await service.update({}, params);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain('The request made had an empty body. Please check your payload');
      }
    });

    it('should fail because the updateRequest is empty', async () => {
      // BUILD
      const params = {
        id: 'testId',
        updateRequest: [],
      };

      // OPERATE
      try {
        await service.update({}, params);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain('The request made had an empty body. Please check your payload');
      }
    });

    it('should fail because the updateRequest contains invalid CIDR ranges', async () => {
      // BUILD
      const params = {
        id: 'testId',
        updateRequest: [
          {
            protocol: 'tcp',
            fromPort: 123,
            toPort: 123,
            cidrBlocks: ['123.123.123.123/32', 'invalidCidr'],
          },
        ],
      };

      // OPERATE
      try {
        await service.update({}, params);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain('The following are invalid CIDR inputs: invalidCidr');
      }
    });

    it('should fail because the updateRequest contains Ipv6 CIDR ranges', async () => {
      // BUILD
      const params = {
        id: 'testId',
        updateRequest: [
          {
            protocol: 'tcp',
            fromPort: 123,
            toPort: 123,
            cidrBlocks: ['123.123.123.123/32', '1234::1234:abcd:ffff:1234:123/64'],
          },
        ],
      };

      // OPERATE
      try {
        await service.update({}, params);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain(
          'Currently only IPv4 formatted CIDR inputs are allowed. Please remove: 1234::1234:abcd:ffff:1234:123/64 CIDR ranges from your list',
        );
      }
    });

    it('should fail because the updateRequest contains duplicate protocol-port combinations', async () => {
      // BUILD
      const params = {
        id: 'testId',
        updateRequest: [
          {
            protocol: 'tcp',
            fromPort: 123,
            toPort: 123,
            cidrBlocks: ['123.123.123.123/32'],
          },
          {
            protocol: 'tcp',
            fromPort: 123,
            toPort: 123,
            cidrBlocks: ['456.456.456.456/32'],
          },
        ],
      };

      // OPERATE
      try {
        await service.update({}, params);
        expect.hasAssertions();
      } catch (err) {
        expect(service.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain(
          'The update request contains duplicate protocol-port combinations. Please make sure all ingress rule objects have unique protocol-fromPort-toPort combinations',
        );
      }
    });
  });

  describe('update', () => {
    it('should fail because the user is not authorized', async () => {
      // BUILD
      const requestContext = {};
      const params = {
        id: 'testId',
        updateRequest: [
          {
            protocol: 'tcp',
            fromPort: 123,
            toPort: 123,
            cidrBlocks: ['123.123.123.123/32'],
          },
        ],
      };
      service.assertAuthorized.mockImplementationOnce(() => {
        throw new Error('User is not authorized');
      });

      // OPERATE
      try {
        await service.update(requestContext, params);
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('User is not authorized');
      }
    });

    it('should use the correct CIDR blocks to make revoke and authorize calls', async () => {
      // BUILD
      const requestContext = {};
      const params = {
        id: 'testId',
        updateRequest: [
          {
            protocol: 'tcp',
            fromPort: 123,
            toPort: 123,
            cidrBlocks: ['123.123.123.123/32'],
          },
        ],
      };
      environmentScService.mustFind = jest.fn(() => ({
        id: 'testId',
        createdBy: 'someUser',
      }));
      const currentIngressRules = [
        {
          protocol: 'tcp',
          fromPort: 123,
          toPort: 123,
          cidrBlocks: ['1.1.1.1/32'],
        },
      ];
      const revokeParams = {
        GroupId: 'samplesecurityGroupId',
        IpPermissions: [{ FromPort: 123, IpProtocol: 'tcp', IpRanges: [{ CidrIp: '1.1.1.1/32' }], ToPort: 123 }],
      };
      const authorizeParams = {
        GroupId: 'samplesecurityGroupId',
        IpPermissions: [
          { FromPort: 123, IpProtocol: 'tcp', IpRanges: [{ CidrIp: '123.123.123.123/32' }], ToPort: 123 },
        ],
      };
      const securityGroupId = 'samplesecurityGroupId';

      environmentScService.getSecurityGroupDetails = jest.fn(() => ({
        currentIngressRules,
        securityGroupId,
      }));
      service.revokeSecurityGroupIngress = jest.fn();
      service.authorizeSecurityGroupIngress = jest.fn();
      service.getEc2Client = jest.fn(() => {
        return {};
      });

      // OPERATE
      await service.update(requestContext, params);

      // CHECK
      expect(service.revokeSecurityGroupIngress).toHaveBeenCalledTimes(1);
      expect(service.authorizeSecurityGroupIngress).toHaveBeenCalledTimes(1);
      expect(service.revokeSecurityGroupIngress).toHaveBeenCalledWith({}, revokeParams);
      expect(service.authorizeSecurityGroupIngress).toHaveBeenCalledWith({}, authorizeParams);
    });

    it('should not call revoke and authorize APIs since there is no change in CIDR blocks', async () => {
      // BUILD
      const requestContext = {};
      const params = {
        id: 'testId',
        updateRequest: [
          {
            protocol: 'tcp',
            fromPort: 123,
            toPort: 123,
            cidrBlocks: ['123.123.123.123/32'],
          },
        ],
      };
      environmentScService.mustFind = jest.fn(() => ({
        id: 'testId',
        createdBy: 'someUser',
      }));
      const currentIngressRules = [params.updateRequest];
      const securityGroupId = 'samplesecurityGroupId';

      environmentScService.getSecurityGroupDetails = jest.fn(() => ({
        currentIngressRules,
        securityGroupId,
      }));
      service.revokeSecurityGroupIngress = jest.fn();
      service.authorizeSecurityGroupIngress = jest.fn();

      // OPERATE
      await service.update(requestContext, params);

      // CHECK
      expect(service.revokeSecurityGroupIngress).not.toHaveBeenCalled();
      expect(service.authorizeSecurityGroupIngress).not.toHaveBeenCalled();
    });
  });
});
