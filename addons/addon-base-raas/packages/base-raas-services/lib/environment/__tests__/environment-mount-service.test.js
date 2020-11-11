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

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('../../study/study-permission-service');
const StudyPermissionServiceMock = require('../../study/study-permission-service');

jest.mock('../../study/study-service');
const StudyServiceMock = require('../../study/study-service');

jest.mock('../../storage-gateway/storage-gateway-service');
const StorageGatewayServiceMock = require('../../storage-gateway/storage-gateway-service');

const EnvironmentMountService = require('../environment-mount-service');

describe('EnvironmentMountService', () => {
  let service = null;
  let studyService = null;
  let storageGatewayService = null;
  const context = { principalIdentifier: { uid: 'u-daffyduck' } };

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('studyPermissionService', new StudyPermissionServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('studyService', new StudyServiceMock());
    container.register('storageGatewayService', new StorageGatewayServiceMock());
    container.register('environmentMountService', new EnvironmentMountService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentMountService');
    studyService = await container.find('studyService');
    storageGatewayService = await container.find('storageGatewayService');
  });

  describe('updateStudyFileMountIPAllowList', () => {
    it('should not call storageGatewayService if mounted studies do not have file share', async () => {
      // BUILD
      const studiesList = [
        { id: 'study1', resources: [{ arn: 'study1-s3-path-arn' }] },
        { id: 'study2', resources: [{ arn: 'study2-s3-path-arn' }] },
      ];
      studyService.listByIds = jest.fn().mockResolvedValueOnce(studiesList);
      const environment = { studyIds: ['study1', 'study2'] };
      // OPERATE
      await service.updateStudyFileMountIPAllowList(context, environment, {});
      // CHECK
      expect(storageGatewayService.updateFileSharesIPAllowedList).not.toHaveBeenCalled();
    });
    it('should not call storageGatewayService with correct parameter for Add IP to allow list', async () => {
      // BUILD
      const studiesList = [
        { id: 'study1', resources: [{ arn: 'study1-s3-path-arn', fileShareArn: 'study1-file-share-arn' }] },
        { id: 'study2', resources: [{ arn: 'study2-s3-path-arn', fileShareArn: 'study2-file-share-arn' }] },
      ];
      studyService.listByIds = jest.fn().mockResolvedValueOnce(studiesList);
      const environment = { studyIds: ['study1', 'study2'] };
      const ipAllowListAction = { ip: '12.23.34.45', action: 'ADD' };
      // OPERATE
      await service.updateStudyFileMountIPAllowList(context, environment, ipAllowListAction);
      // CHECK
      expect(storageGatewayService.updateFileSharesIPAllowedList).toHaveBeenCalledWith(
        ['study1-file-share-arn', 'study2-file-share-arn'],
        '12.23.34.45',
        'ADD',
      );
    });
    it('should not call storageGatewayService with correct parameter for Remove IP from allow list', async () => {
      // BUILD
      const studiesList = [
        { id: 'study1', resources: [{ arn: 'study1-s3-path-arn', fileShareArn: 'study1-file-share-arn' }] },
        { id: 'study2', resources: [{ arn: 'study2-s3-path-arn', fileShareArn: 'study2-file-share-arn' }] },
      ];
      studyService.listByIds = jest.fn().mockResolvedValueOnce(studiesList);
      const environment = {
        studyIds: ['study1', 'study2'],
        outputs: [{ OutputKey: 'Ec2WorkspaceInstanceId', OutputValue: '34.45.56.67' }],
      };
      const ipAllowListAction = { action: 'REMOVE' };
      // OPERATE
      await service.updateStudyFileMountIPAllowList(context, environment, ipAllowListAction);
      // CHECK
      expect(storageGatewayService.updateFileSharesIPAllowedList).toHaveBeenCalledWith(
        ['study1-file-share-arn', 'study2-file-share-arn'],
        '34.45.56.67',
        'REMOVE',
      );
    });
  });
});
