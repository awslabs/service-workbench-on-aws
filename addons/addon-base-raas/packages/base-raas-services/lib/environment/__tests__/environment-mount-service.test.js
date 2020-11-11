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

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/iam/iam-service');
const IamServiceMock = require('@aws-ee/base-services/lib/iam/iam-service');

jest.mock('@aws-ee/base-services/lib/aws/aws-service');
const AwsServiceMock = require('@aws-ee/base-services/lib/aws/aws-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('../../study/study-service');
const StudyServiceMock = require('../../study/study-service');

jest.mock('../../study/study-permission-service');
const StudyPermissionServiceMock = require('../../study/study-permission-service');

jest.mock('../service-catalog/environment-sc-service');
const EnvironmentScServiceMock = require('../service-catalog/environment-sc-service');

const EnvironmentMountService = require('../environment-mount-service.js');

describe('EnvironmentMountService', () => {
  let service = null;
  let environmentScService = null;
  let iamService = null;

  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('environmentScService', new EnvironmentScServiceMock());
    container.register('environmentMountService', new EnvironmentMountService());
    container.register('studyService', new StudyServiceMock());
    container.register('studyPermissionService', new StudyPermissionServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('aws', new AwsServiceMock());
    container.register('iamService', new IamServiceMock());
    container.register('settings', new SettingsServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('environmentMountService');
    environmentScService = await container.find('environmentScService');
    iamService = await container.find('iamService');
  });

  describe('Update paths', () => {
    it('should call nothing if all are admin changes', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'admin' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).not.toHaveBeenCalled();
      expect(service.removePermissions).not.toHaveBeenCalled();
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should call add when only adds are requested', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).toHaveBeenCalledWith([{ uid: 'User1-UID', permissionLevel: 'readonly' }], studyId);
      expect(service.removePermissions).not.toHaveBeenCalled();
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should call remove when only removals are requested', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'admin' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).not.toHaveBeenCalled();
      expect(service.removePermissions).toHaveBeenCalledWith(
        [{ uid: 'User2-UID', permissionLevel: 'readwrite' }],
        studyId,
      );
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should call update when only updates are requested', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).not.toHaveBeenCalled();
      expect(service.removePermissions).not.toHaveBeenCalled();
      // We send a list of all users in the remove list, who are also present in the add list.
      expect(service.updatePermissions).toHaveBeenCalledWith(
        [{ uid: 'User1-UID', permissionLevel: 'readwrite' }],
        studyId,
        updateRequest,
      );
    });

    it('should call everything when everything', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
        usersToRemove: [{ uid: 'User2-UID', permissionLevel: 'admin' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      service.removePermissions = jest.fn();
      service.updatePermissions = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(service.addPermissions).toHaveBeenCalled();
      expect(service.removePermissions).not.toHaveBeenCalled();
      expect(service.updatePermissions).not.toHaveBeenCalled();
    });

    it('should not call putRolePolicy when user does not own any environments', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      service.addPermissions = jest.fn();
      environmentScService.getActiveEnvsForUser = jest.fn(); // No environments returned
      iamService.putRolePolicy = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).not.toHaveBeenCalled();
    });

    it('should not call putRolePolicy when environment does not have the study mounted', async () => {
      // BUILD
      const updateRequest = {
        usersToAdd: [{ uid: 'User1-UID', permissionLevel: 'readonly' }],
      };
      const studyId = 'StudyA';
      const envsForUser = [{ studyIds: ['StudyB'] }]; // StudyA not mounted on env
      service.addPermissions = jest.fn();
      environmentScService.getActiveEnvsForUser = jest.fn().mockResolvedValue(envsForUser);
      iamService.putRolePolicy = jest.fn();

      // OPERATE
      await service.applyWorkspacePermissions(studyId, updateRequest);

      // CHECK
      expect(iamService.putRolePolicy).not.toHaveBeenCalled();
    });
  });
});
