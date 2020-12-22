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
const AwsService = require('@aws-ee/base-services/lib/aws/aws-service');
const JsonSchemaValidationService = require('@aws-ee/base-services/lib/json-schema-validation-service');

jest.mock('@aws-ee/base-services/lib/logger/logger-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');
const AWSMock = require('aws-sdk-mock');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/user/user-service');
const UserServiceMock = require('@aws-ee/base-services/lib/user/user-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../../study/study-service');
const StudyServiceMock = require('../../study/study-service');

const StorageGateway = require('../storage-gateway-service');

describe('storageGatewayService', () => {
  let storageGateway;
  let userService;
  let log;
  let dbService;
  let studyService;
  let lockService;
  const context = { principalIdentifier: { uid: 'u-daffyduck' } };

  beforeAll(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('log', new Logger());
    container.register('aws', new AwsService());
    container.register('storageGatewayService', new StorageGateway());
    container.register('dbService', new DbServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('studyService', new StudyServiceMock());
    container.register('lockService', new LockServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    storageGateway = await container.find('storageGatewayService');
    userService = await container.find('userService');
    log = await container.find('log');
    dbService = await container.find('dbService');
    studyService = await container.find('studyService');
    lockService = await container.find('lockService');
  });

  beforeEach(async () => {
    const aws = await storageGateway.service('aws');
    AWSMock.setSDKInstance(aws.sdk);
  });

  afterEach(() => {
    AWSMock.restore();
  });

  describe('activateGateway', () => {
    it('should fail if storage gateway throws exception', async () => {
      const rawDataInput = {
        publicIp: '11.11.11.11',
        region: 'us-west-2',
        securityGroup: 'security-group-id',
        timezone: 'GMT',
      };
      const whitelistIPInput = {
        GroupId: rawDataInput.securityGroup,
        IpPermissions: [
          {
            FromPort: 80,
            IpProtocol: 'tcp',
            IpRanges: [
              {
                CidrIp: `22.22.22.22/32`,
                Description: 'Temporary SSH access from Lambda function',
              },
            ],
            ToPort: 80,
          },
        ],
      };
      userService.mustFindUser = jest.fn().mockImplementationOnce(params => {
        expect(params).toMatchObject(context.principalIdentifier);
        return { username: 'hello@activate_gateway.com' };
      });
      storageGateway.fetchIP = jest.fn().mockImplementationOnce(() => {
        return '22.22.22.22';
      });
      storageGateway.fetchRedirect = jest.fn().mockImplementationOnce(params => {
        expect(params).toEqual('http://11.11.11.11/?activationRegion=us-west-2&gatewayType=FILE_S3');
        return 'http://11.11.11.11?activationRegion=us-west-2&activationKey=11111-11111-11111-11111-11111&gatewayType=FILE_S3';
      });
      AWSMock.mock('StorageGateway', 'activateGateway', (params, callback) => {
        expect(params).toMatchObject(
          expect.objectContaining({
            ActivationKey: '11111-11111-11111-11111-11111',
            GatewayName: expect.any(String),
            GatewayRegion: 'us-west-2',
            GatewayTimezone: 'GMT',
            GatewayType: 'FILE_S3',
            Tags: [
              {
                Key: 'CreatedBy',
                Value: 'hello@activate_gateway.com',
              },
            ],
          }),
        );
        callback({ code: 'InvalidGatewayRequestException' }, null);
      });
      AWSMock.mock('EC2', 'authorizeSecurityGroupIngress', (params, callback) => {
        expect(params).toMatchObject(whitelistIPInput);
        callback(null, null);
      });
      let revokeCalled = false;
      AWSMock.mock('EC2', 'revokeSecurityGroupIngress', (params, callback) => {
        expect(params).toMatchObject(whitelistIPInput);
        revokeCalled = true;
        callback(null, null);
      });
      try {
        await storageGateway.activateGateway(context, rawDataInput);
        expect.fail('Expected to throw error InvalidGatewayRequestException');
      } catch (error) {
        expect(error).toMatchObject({ code: 'InvalidGatewayRequestException' });
        expect(storageGateway.fetchIP).toHaveBeenCalledTimes(1);
        expect(storageGateway.fetchRedirect).toHaveBeenCalledTimes(1);
        expect(userService.mustFindUser).toHaveBeenCalledTimes(1);
        // ensure that even though we have an error, permissions should be revoked
        expect(revokeCalled).toEqual(true);
      }
    });

    it('should succeed', async () => {
      const rawDataInput = {
        publicIp: '11.11.11.11',
        region: 'us-west-2',
        securityGroup: 'security-group-id',
        timezone: 'GMT',
      };
      const whitelistIPInput = {
        GroupId: rawDataInput.securityGroup,
        IpPermissions: [
          {
            FromPort: 80,
            IpProtocol: 'tcp',
            IpRanges: [
              {
                CidrIp: `22.22.22.22/32`,
                Description: 'Temporary SSH access from Lambda function',
              },
            ],
            ToPort: 80,
          },
        ],
      };
      const expectedGatewayARN = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      userService.mustFindUser = jest.fn().mockImplementationOnce(params => {
        expect(params).toMatchObject(context.principalIdentifier);
        return { username: 'hello@activate_gateway.com' };
      });
      storageGateway.fetchIP = jest.fn().mockImplementationOnce(() => {
        return '22.22.22.22';
      });
      storageGateway.fetchRedirect = jest.fn().mockImplementationOnce(params => {
        expect(params).toEqual('http://11.11.11.11/?activationRegion=us-west-2&gatewayType=FILE_S3');
        return 'http://11.11.11.11?activationRegion=us-west-2&gatewayType=FILE_S3&activationKey=11111-11111-11111-11111-11111';
      });
      AWSMock.mock('StorageGateway', 'activateGateway', (params, callback) => {
        expect(params).toMatchObject(
          expect.objectContaining({
            ActivationKey: '11111-11111-11111-11111-11111',
            GatewayName: expect.any(String),
            GatewayRegion: 'us-west-2',
            GatewayTimezone: 'GMT',
            GatewayType: 'FILE_S3',
            Tags: [
              {
                Key: 'CreatedBy',
                Value: 'hello@activate_gateway.com',
              },
            ],
          }),
        );
        callback(null, expectedGatewayARN);
      });
      AWSMock.mock('EC2', 'authorizeSecurityGroupIngress', (params, callback) => {
        expect(params).toMatchObject(whitelistIPInput);
        callback(null, null);
      });
      AWSMock.mock('EC2', 'revokeSecurityGroupIngress', (params, callback) => {
        expect(params).toMatchObject(whitelistIPInput);
        callback(null, null);
      });
      const receivedResponse = await storageGateway.activateGateway(context, rawDataInput);
      expect(expectedGatewayARN.GatewayARN).toEqual(receivedResponse);
      expect(storageGateway.fetchIP).toHaveBeenCalledTimes(1);
      expect(storageGateway.fetchRedirect).toHaveBeenCalledTimes(1);
      expect(userService.mustFindUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteGateway', () => {
    it('should fail on bad GatewayARN', async () => {
      const expectedRequest = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      AWSMock.mock('StorageGateway', 'deleteGateway', (params, callback) => {
        expect(params).toMatchObject(expectedRequest);
        callback({ code: 'InvalidGatewayARN' }, null);
      });
      try {
        await storageGateway.deleteGateway(
          context,
          'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
        );
        expect.fail('Expected to throw error InvalidGatewayARN');
      } catch (error) {
        expect(error).toEqual({ code: 'InvalidGatewayARN' });
      }
    });

    it('should succeed on correct GatewayARN', async () => {
      const deleteResponse = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      const expectedRequest = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      AWSMock.mock('StorageGateway', 'deleteGateway', (params, callback) => {
        expect(params).toMatchObject(expectedRequest);
        callback(null, deleteResponse);
      });
      await storageGateway.deleteGateway(context, 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111');
    });
  });

  describe('addCacheToGateway', () => {
    it('should fail on invalid GatewayARN', async () => {
      const rawData = {
        volumeId: 'volume-123',
        gatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      const volumeIdRequest = {
        VolumeIds: [rawData.volumeId],
      };
      const gatewayARNParam = {
        GatewayARN: rawData.gatewayARN,
      };
      const volumeResponse = {
        Volumes: [
          {
            Attachments: [
              {
                Device: '/dev/sdc',
              },
            ],
            Size: 150,
          },
        ],
      };
      AWSMock.mock('EC2', 'describeVolumes', (params, callback) => {
        expect(params).toMatchObject(volumeIdRequest);
        callback(null, volumeResponse);
      });
      AWSMock.mock('StorageGateway', 'listLocalDisks', (params, callback) => {
        expect(params).toMatchObject(gatewayARNParam);
        callback({ code: 'InvalidGatewayARN' }, null);
      });
      try {
        await storageGateway.addCacheToGateway(context, rawData);
        expect.fail('Expected to throw error InvalidGatewayARN');
      } catch (error) {
        expect(error).toEqual({ code: 'InvalidGatewayARN' });
      }
    });

    it('should succeed on valid GatewayARN', async () => {
      const rawData = {
        volumeId: 'volume-123',
        gatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      const volumeIdRequest = {
        VolumeIds: [rawData.volumeId],
      };
      const gatewayARNParam = {
        GatewayARN: rawData.gatewayARN,
      };
      const volumeResponse = {
        Volumes: [
          {
            Attachments: [
              {
                Device: '/dev/sdc',
              },
            ],
            Size: 150,
          },
        ],
      };
      const localDisksResponse = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
        Disks: [
          {
            DiskId: '7c3164b9-b237-40d2-9647-a4839a9b7bd1',
            DiskPath: '/dev/nvme1n1',
            DiskNode: '/dev/sdc',
            DiskStatus: 'present',
            DiskSizeInBytes: 161061273600,
            DiskAllocationType: 'CACHE STORAGE',
            DiskAttributeList: [],
          },
          {
            DiskId: '7c3164b9-b237-40d2-9647-a4839a9b7bd2',
            DiskPath: '/dev/nvme1n1',
            DiskNode: '/dev/sdc',
            DiskStatus: 'present',
            DiskSizeInBytes: 161061273600 * 2,
            DiskAllocationType: 'available',
            DiskAttributeList: [],
          },
          {
            DiskId: '7c3164b9-b237-40d2-9647-a4839a9b7b3',
            DiskPath: '/dev/nvme1n1',
            DiskNode: '/dev/sdb',
            DiskStatus: 'present',
            DiskSizeInBytes: 161061273600,
            DiskAllocationType: 'available',
            DiskAttributeList: [],
          },
          {
            DiskId: '7c3164b9-b237-40d2-9647-a4839a9b7bd4',
            DiskPath: '/dev/nvme1n1',
            DiskNode: '/dev/sdc',
            DiskStatus: 'present',
            DiskSizeInBytes: 161061273600,
            DiskAllocationType: 'available',
            DiskAttributeList: [],
          },
          {
            DiskId: '7c3164b9-b237-40d2-9647-a4839a9b7bd5',
            DiskPath: '/dev/nvme1n1',
            DiskNode: '/dev/sdc',
            DiskStatus: 'absent',
            DiskSizeInBytes: 161061273600,
            DiskAllocationType: 'available',
            DiskAttributeList: [],
          },
        ],
      };
      const addToCacheParams = {
        // Pick the disk which is present, available and matches input disk spec
        DiskIds: [localDisksResponse.Disks[3].DiskId],
        GatewayARN: rawData.gatewayARN,
      };
      AWSMock.mock('EC2', 'describeVolumes', (params, callback) => {
        expect(params).toMatchObject(volumeIdRequest);
        callback(null, volumeResponse);
      });
      AWSMock.mock('StorageGateway', 'listLocalDisks', (params, callback) => {
        expect(params).toMatchObject(gatewayARNParam);
        callback(null, localDisksResponse);
      });
      let addCacheCalled = 0;
      AWSMock.mock('StorageGateway', 'addCache', (params, callback) => {
        addCacheCalled += 1;
        expect(params).toMatchObject(addToCacheParams);
        callback(null, null);
      });
      await storageGateway.addCacheToGateway(context, rawData);
      expect(addCacheCalled).toEqual(1);
    });
  });

  describe('listLocalDisks', () => {
    it('should fail on invalid GatewayARN', async () => {
      const expectedRequest = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      AWSMock.mock('StorageGateway', 'listLocalDisks', (params, callback) => {
        expect(params).toMatchObject(expectedRequest);
        callback({ code: 'InvalidGatewayARN' }, null);
      });
      try {
        await storageGateway.listLocalDisks(
          context,
          'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
        );
        expect.fail('Expected to throw error InvalidGatewayARN');
      } catch (error) {
        expect(error).toEqual({ code: 'InvalidGatewayARN' });
      }
    });

    it('should succeed on valid GatewayARN', async () => {
      const localDisksResponse = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
        Disks: [
          {
            DiskId: '7c3164b9-b237-40d2-9647-a4839a9b7bd3',
            DiskPath: '/dev/nvme1n1',
            DiskNode: '/dev/sdc',
            DiskStatus: 'present',
            DiskSizeInBytes: 161061273600,
            DiskAllocationType: 'CACHE STORAGE',
            DiskAttributeList: [],
          },
        ],
      };
      const expectedRequest = {
        GatewayARN: 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      };
      AWSMock.mock('StorageGateway', 'listLocalDisks', (params, callback) => {
        expect(params).toMatchObject(expectedRequest);
        callback(null, localDisksResponse);
      });
      const receivedResponse = await storageGateway.listLocalDisks(
        context,
        'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111',
      );
      expect(localDisksResponse).toEqual(receivedResponse);
    });
  });

  describe('saveToDDB', () => {
    it('should fail on invalid input', async () => {
      const dbData = {
        vpcId: 'vpc-123',
        subnetId: 'subnet-123',
        ec2Instance: 'gateway-instance123',
        elasticIP: '11.11.11.aa',
        securityGroup: 'gateway-sg',
        ec2RoleARN: 'arn:aws:iam:us-west-2:111111111111:role/gateway-role',
        invalidField: 'invalid',
      };
      const gatewayArn = 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111';
      try {
        await storageGateway.saveToDDB(context, dbData, gatewayArn);
        expect.fail('Expected to have validation errors');
      } catch (error) {
        // extra field
        // invalid vpcId
        // invalid subnetId
        // invalid IP address
        // volumeIds field is missing
        expect(error.payload.validationErrors.length).toEqual(5);
        log.error(error);
      }
      expect(dbService.table.key).toHaveBeenCalledTimes(0);
      expect(dbService.table.item).toHaveBeenCalledTimes(0);
      expect(dbService.table.update).toHaveBeenCalledTimes(0);
    });

    it('should succeed on valid input', async () => {
      const dbData = {
        vpcId: 'vpc-12345678',
        subnetId: 'subnet-12345678',
        ec2Instance: 'gateway-instance123',
        elasticIP: '11.11.11.11',
        securityGroup: 'gateway-sg',
        ec2RoleARN: 'arn:aws:iam:us-west-2:111111111111:role/gateway-role',
        volumeIds: ['volume-123'],
        cfnStackId: 'arn:aws:cloudformation:us-east-2:123456789012:stack/mystack/newstack123',
      };
      const userId = context.principalIdentifier.uid;
      const gatewayArn = 'arn:aws:storagegateway:us-west-2:111111111111:gateway/sgw-11111111';
      try {
        await storageGateway.saveToDDB(context, dbData, gatewayArn);
      } catch (error) {
        log.error(error);
        throw error;
      }
      expect(dbService.table.key).toHaveBeenCalledWith({ id: gatewayArn });
      expect(dbService.table.item).toHaveBeenCalledWith(
        expect.objectContaining({
          vpcId: dbData.vpcId,
          subnetId: dbData.subnetId,
          ec2Instance: dbData.ec2Instance,
          elasticIP: dbData.elasticIP,
          securityGroup: dbData.securityGroup,
          ec2RoleARN: dbData.ec2RoleARN,
          volumeIds: dbData.volumeIds,
          rev: 0,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      expect(dbService.table.update).toHaveBeenCalled();
    });
  });

  describe('createFileShare', () => {
    it('should return existing file share', async () => {
      // BUILD
      studyService.mustFind.mockResolvedValue({
        resources: [{ arn: 'some-s3-path', fileShareArn: 'fileShareArn' }],
      });
      // OPERATE
      const result = await storageGateway.createFileShare(context, 'gatewayArn', 'studyId', 'roleArn');
      // CHECK
      expect(result).toEqual('fileShareArn');
    });

    it('should throw error if there are multiple s3 path', async () => {
      // BUILD
      studyService.mustFind.mockResolvedValue({
        resources: [
          { arn: 'some-s3-path', fileShareArn: 'fileShareArn' },
          { arn: 'some-other-s3-path', fileShareArn: 'anotherFileShareArn' },
        ],
      });
      // OPERATE and CHECK
      try {
        await storageGateway.createFileShare(context, 'gatewayArn', 'studyId', 'roleArn');
        expect.hasAssertions();
      } catch (err) {
        expect(storageGateway.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain(
          `Study studyId has 2 S3 paths associated with it, only study with 1 s3 path is supported.`,
        );
      }
    });

    it('should throw error if SG record can not be found', async () => {
      // BUILD
      studyService.mustFind.mockResolvedValue({
        resources: [{ arn: 'some-s3-path' }],
      });
      dbService.table.get.mockResolvedValueOnce(null);
      // OPERATE and CHECK
      try {
        await storageGateway.createFileShare(context, 'gatewayArn', 's3LocationArn', 'roleArn');
        expect.hasAssertions();
      } catch (err) {
        expect(storageGateway.boom.is(err, 'notFound')).toBe(true);
        expect(err.message).toContain('storage gateway with id "gatewayArn" does not exist');
      }
    });

    it('should create new file share and save to DDB', async () => {
      // BUILD
      studyService.mustFind.mockResolvedValue({
        resources: [{ arn: 's3LocationArn' }],
      });
      dbService.table.item.mockClear();
      dbService.table.get
        .mockReturnValueOnce({
          elasticIP: '10.52.4.93',
          fileShares: { anotherS3LocationArn: 'anotherFileShareArn' },
          rev: 3,
        })
        .mockReturnValueOnce({
          elasticIP: '10.52.4.93',
          fileShares: { anotherS3LocationArn: 'anotherFileShareArn' },
          rev: 3,
        });

      const expectedRequest = {
        ClientToken: expect.any(String),
        GatewayARN: 'gatewayArn',
        LocationARN: 's3LocationArn',
        Role: 'roleArn',
        ClientList: ['10.52.4.93/32'],
      };
      const sgResponse = { FileShareARN: 'newFileShareArn' };
      AWSMock.mock('StorageGateway', 'createNFSFileShare', (params, callback) => {
        expect(params).toEqual(expectedRequest);
        callback(null, sgResponse);
      });
      AWSMock.mock('StorageGateway', 'listFileShares', (params, callback) => {
        expect(params).toEqual({ GatewayARN: 'gatewayArn' });
        callback(null, { FileShareInfoList: [] });
      });
      // OPERATE
      const result = await storageGateway.createFileShare(context, 'gatewayArn', 's3LocationArn', 'roleArn');
      // CHECK
      expect(result).toEqual('newFileShareArn');
      expect(dbService.table.item).toHaveBeenCalledWith({
        fileShares: {
          anotherS3LocationArn: 'anotherFileShareArn',
          s3LocationArn: 'newFileShareArn',
        },
        rev: 3,
        updatedBy: 'u-daffyduck',
      });
      expect(studyService.update).toHaveBeenCalledWith(context, {
        resources: [
          {
            arn: 's3LocationArn',
            fileShareArn: 'newFileShareArn',
          },
        ],
      });
    });

    it('should create new file share with KMS key when override is provided', async () => {
      // BUILD
      studyService.mustFind.mockResolvedValue({
        resources: [{ arn: 's3LocationArn' }],
      });
      dbService.table.item.mockClear();
      dbService.table.get
        .mockReturnValueOnce({
          elasticIP: '10.52.4.93',
          fileShares: { anotherS3LocationArn: 'anotherFileShareArn' },
          rev: 3,
        })
        .mockReturnValueOnce({
          elasticIP: '10.52.4.93',
          fileShares: { anotherS3LocationArn: 'anotherFileShareArn' },
          rev: 3,
        });

      const expectedRequest = {
        ClientToken: expect.any(String),
        GatewayARN: 'gatewayArn',
        LocationARN: 's3LocationArn',
        Role: 'roleArn',
        ClientList: ['10.52.4.93/32'],
        KMSEncrypted: true,
        KMSKey: 'arn:aws:kms:us-east-1:1234567890:key/some-kms-key-name',
      };
      const sgResponse = { FileShareARN: 'newFileShareArn' };
      AWSMock.mock('StorageGateway', 'createNFSFileShare', (params, callback) => {
        expect(params).toEqual(expectedRequest);
        callback(null, sgResponse);
      });
      AWSMock.mock('StorageGateway', 'listFileShares', (params, callback) => {
        expect(params).toEqual({ GatewayARN: 'gatewayArn' });
        callback(null, { FileShareInfoList: [] });
      });
      // OPERATE
      const result = await storageGateway.createFileShare(context, 'gatewayArn', 's3LocationArn', 'roleArn', {
        KMSEncrypted: true,
        KMSKey: 'arn:aws:kms:us-east-1:1234567890:key/some-kms-key-name',
      });
      // CHECK
      expect(result).toEqual('newFileShareArn');
      expect(dbService.table.item).toHaveBeenCalledWith({
        fileShares: {
          anotherS3LocationArn: 'anotherFileShareArn',
          s3LocationArn: 'newFileShareArn',
        },
        rev: 3,
        updatedBy: 'u-daffyduck',
      });
      expect(studyService.update).toHaveBeenCalledWith(context, {
        resources: [
          {
            arn: 's3LocationArn',
            fileShareArn: 'newFileShareArn',
          },
        ],
      });
    });

    it('should continue with DB update if file share already exist', async () => {
      // BUILD
      studyService.mustFind.mockResolvedValue({
        resources: [{ arn: 's3LocationArn' }],
      });
      dbService.table.item.mockClear();
      dbService.table.get
        .mockReturnValueOnce({
          elasticIP: '10.52.4.93',
          fileShares: { anotherS3LocationArn: 'anotherFileShareArn' },
          rev: 3,
        })
        .mockReturnValueOnce({
          elasticIP: '10.52.4.93',
          fileShares: { anotherS3LocationArn: 'anotherFileShareArn' },
          rev: 3,
        });

      AWSMock.mock('StorageGateway', 'listFileShares', (params, callback) => {
        expect(params).toEqual({ GatewayARN: 'gatewayArn' });
        callback(null, { FileShareInfoList: [{ FileShareType: 'NFS', FileShareARN: 'an-existing-file-share-arn' }] });
      });
      AWSMock.mock('StorageGateway', 'describeNFSFileShares', (params, callback) => {
        expect(params).toEqual({ FileShareARNList: ['an-existing-file-share-arn'] });
        callback(null, {
          NFSFileShareInfoList: [{ FileShareARN: 'an-existing-file-share-arn', LocationARN: 's3LocationArn' }],
        });
      });
      // OPERATE
      const result = await storageGateway.createFileShare(context, 'gatewayArn', 's3LocationArn', 'roleArn', {
        KMSEncrypted: true,
        KMSKey: 'arn:aws:kms:us-east-1:1234567890:key/some-kms-key-name',
      });
      // CHECK
      expect(result).toEqual('an-existing-file-share-arn');
      expect(dbService.table.item).toHaveBeenCalledWith({
        fileShares: {
          anotherS3LocationArn: 'anotherFileShareArn',
          s3LocationArn: 'an-existing-file-share-arn',
        },
        rev: 3,
        updatedBy: 'u-daffyduck',
      });
      expect(studyService.update).toHaveBeenCalledWith(context, {
        resources: [
          {
            arn: 's3LocationArn',
            fileShareArn: 'an-existing-file-share-arn',
          },
        ],
      });
    });
  });

  describe('updateFileShareIPAllowedList', () => {
    it('should throw bad request error if an invalid action is passed in', async () => {
      // OPERATE n CHECK
      try {
        await storageGateway.updateFileSharesIPAllowedList(
          ['file-share-arn-1', 'file-share-arn-2'],
          '12.23.34.45',
          'UPDATE',
        );
        expect.hasAssertions();
      } catch (err) {
        expect(storageGateway.boom.is(err, 'badRequest')).toBe(true);
        expect(err.message).toContain('Action UPDATE is not valid, only ADD and REMOVE are supported.');
      }
    });
    it('should throw can not retain lock error when tryWriteLockAndRun fails', async () => {
      // BUILD
      lockService.tryWriteLockAndRun.mockImplementationOnce(async () => {
        throw storageGateway.boom.internalError('Could not obtain a lock', true);
      });

      // OPERATE n CHECK
      try {
        await storageGateway.updateFileSharesIPAllowedList(
          ['file-share-arn-1', 'file-share-arn-2'],
          '12.23.34.45',
          'ADD',
        );
        expect.hasAssertions();
      } catch (err) {
        expect(storageGateway.boom.is(err, 'internalError')).toBe(true);
        expect(err.message).toContain('Could not obtain a lock');
      }
    });
    it('should ADD ip address successfully', async () => {
      // BUILD
      lockService.tryWriteLockAndRun.mockImplementation(async (_ignore, fn) => {
        await fn();
      });
      let count = 0;
      AWSMock.mock('StorageGateway', 'describeNFSFileShares', (params, callback) => {
        count += 1;
        if (params.FileShareARNList[0] === 'file-share-arn-1') {
          callback(null, { NFSFileShareInfoList: [{ ClientList: ['12.45.78.90/32'] }] });
        } else if (params.FileShareARNList[0] === 'file-share-arn-2') {
          callback(null, { NFSFileShareInfoList: [{ ClientList: ['12.23.34.45/32'] }] });
        } else {
          throw Error(`Invalid parameter ${params} when calling listFileShares`);
        }
      });
      AWSMock.mock('StorageGateway', 'updateNFSFileShare', (params, callback) => {
        count += 1;
        if (params.FileShareARN === 'file-share-arn-1') {
          expect(params.ClientList).toEqual(['12.45.78.90/32', '12.23.34.45/32']);
        } else if (params.FileShareARN === 'file-share-arn-2') {
          expect(params.ClientList).toEqual(['12.23.34.45/32']);
        } else {
          throw Error(`Invalid parameter ${params} when calling listFileShares`);
        }
        callback(null, {});
      });
      // OPERATE n CHECK
      await storageGateway.updateFileSharesIPAllowedList(
        ['file-share-arn-1', 'file-share-arn-2'],
        '12.23.34.45',
        'ADD',
      );
      if (count !== 3) {
        throw Error(`StorageGateway was called ${count} times. It should have been called 3 times.`);
      }
    });
    it('should REMOVE ip address successfully', async () => {
      // BUILD
      lockService.tryWriteLockAndRun.mockImplementation(async (lockId, fn) => {
        await fn();
      });
      let count = 0;
      AWSMock.mock('StorageGateway', 'describeNFSFileShares', (params, callback) => {
        count += 1;
        if (params.FileShareARNList[0] === 'file-share-arn-1') {
          callback(null, { NFSFileShareInfoList: [{ ClientList: ['12.45.78.90/32', '12.23.34.45/32'] }] });
        } else if (params.FileShareARNList[0] === 'file-share-arn-2') {
          callback(null, {
            NFSFileShareInfoList: [{ ClientList: ['12.45.78.90/32', '09.98.87.76/32', '12.23.34.45/32'] }],
          });
        } else {
          throw Error(`Invalid parameter ${params} when calling listFileShares`);
        }
      });
      AWSMock.mock('StorageGateway', 'updateNFSFileShare', (params, callback) => {
        count += 1;
        if (params.FileShareARN === 'file-share-arn-1') {
          expect(params.ClientList).toEqual(['12.45.78.90/32']);
        } else if (params.FileShareARN === 'file-share-arn-2') {
          expect(params.ClientList).toEqual(['12.45.78.90/32', '09.98.87.76/32']);
        } else {
          throw Error(`Invalid parameter ${params} when calling listFileShares`);
        }
        callback(null, {});
      });
      // OPERATE n CHECK
      await storageGateway.updateFileSharesIPAllowedList(
        ['file-share-arn-1', 'file-share-arn-2'],
        '12.23.34.45',
        'REMOVE',
      );
      if (count !== 4) {
        throw Error(`StorageGateway was called ${count} times. It should have been called 4 times.`);
      }
    });
  });

  describe('updateStudyFileMountIPAllowList', () => {
    it('should not call storageGatewayService if mounted studies do not have file share', async () => {
      // BUILD
      storageGateway.updateFileSharesIPAllowedList = jest.fn();
      const studiesList = [
        { id: 'study1', resources: [{ arn: 'study1-s3-path-arn' }] },
        { id: 'study2', resources: [{ arn: 'study2-s3-path-arn' }] },
      ];
      studyService.listByIds = jest.fn().mockResolvedValueOnce(studiesList);
      const environment = { studyIds: ['study1', 'study2'] };
      // OPERATE
      await storageGateway.updateStudyFileMountIPAllowList(context, environment, {});
      // CHECK
      expect(storageGateway.updateFileSharesIPAllowedList).not.toHaveBeenCalled();
    });

    it('should call storageGatewayService with correct parameter for Add IP to allow list', async () => {
      // BUILD
      storageGateway.updateFileSharesIPAllowedList = jest.fn();
      const studiesList = [
        { id: 'study1', resources: [{ arn: 'study1-s3-path-arn', fileShareArn: 'study1-file-share-arn' }] },
        { id: 'study2', resources: [{ arn: 'study2-s3-path-arn', fileShareArn: 'study2-file-share-arn' }] },
      ];
      studyService.listByIds = jest.fn().mockResolvedValueOnce(studiesList);
      const environment = { studyIds: ['study1', 'study2'] };
      const ipAllowListAction = { ip: '12.23.34.45', action: 'ADD' };
      // OPERATE
      await storageGateway.updateStudyFileMountIPAllowList(context, environment, ipAllowListAction);
      // CHECK
      expect(storageGateway.updateFileSharesIPAllowedList).toHaveBeenCalledWith(
        ['study1-file-share-arn', 'study2-file-share-arn'],
        '12.23.34.45',
        'ADD',
      );
    });

    it('should not call storageGatewayService when ip it not in environment or ipAllowListAction', async () => {
      // BUILD
      storageGateway.updateFileSharesIPAllowedList = jest.fn();
      const studiesList = [
        { id: 'study1', resources: [{ arn: 'study1-s3-path-arn', fileShareArn: 'study1-file-share-arn' }] },
        { id: 'study2', resources: [{ arn: 'study2-s3-path-arn', fileShareArn: 'study2-file-share-arn' }] },
      ];
      studyService.listByIds = jest.fn().mockResolvedValueOnce(studiesList);
      const environment = {
        studyIds: ['study1', 'study2'],
        outputs: [{ OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: 'some-ec2-instance-id' }],
      };
      const ipAllowListAction = { action: 'REMOVE' };
      // OPERATE
      await storageGateway.updateStudyFileMountIPAllowList(context, environment, ipAllowListAction);
      // CHECK
      expect(storageGateway.updateFileSharesIPAllowedList).not.toHaveBeenCalled();
    });

    it('should call storageGatewayService with correct parameter for REMOVE IP to allow list', async () => {
      // BUILD
      storageGateway.updateFileSharesIPAllowedList = jest.fn();
      const studiesList = [
        { id: 'study1', resources: [{ arn: 'study1-s3-path-arn', fileShareArn: 'study1-file-share-arn' }] },
        { id: 'study2', resources: [{ arn: 'study2-s3-path-arn', fileShareArn: 'study2-file-share-arn' }] },
      ];
      studyService.listByIds = jest.fn().mockResolvedValueOnce(studiesList);
      const environment = {
        studyIds: ['study1', 'study2'],
        outputs: [{ OutputKey: 'Ec2WorkspacePublicIp', OutputValue: '34.45.56.67' }],
      };
      const ipAllowListAction = { action: 'REMOVE' };
      // OPERATE
      await storageGateway.updateStudyFileMountIPAllowList(context, environment, ipAllowListAction);
      // CHECK
      expect(storageGateway.updateFileSharesIPAllowedList).toHaveBeenCalledWith(
        ['study1-file-share-arn', 'study2-file-share-arn'],
        '34.45.56.67',
        'REMOVE',
      );
    });
  });
});
