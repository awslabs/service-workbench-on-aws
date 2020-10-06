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
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

jest.mock('@aws-ee/base-services/lib/lock/lock-service');
const LockServiceMock = require('@aws-ee/base-services/lib/lock/lock-service');

jest.mock('@aws-ee/base-services/lib/user/user-service');
const UserServiceMock = require('@aws-ee/base-services/lib/user/user-service');

const StudyPermissionService = require('../study-permission-service');

// Tested functions: create, update, delete
describe('studyPermissionService', () => {
  let service = null;
  let dbService = null;
  let lockService = null;
  const error = { code: 'ConditionalCheckFailedException' };
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('jsonSchemaValidationService', new JsonSchemaValidationService());
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('lockService', new LockServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('studyPermissionService', new StudyPermissionService());

    await container.initServices();

    service = await container.find('studyPermissionService');
    dbService = await container.find('dbService');
    lockService = await container.find('lockService');

    // skip authorization
    service.assertAuthorized = jest.fn();

    // fix lock function
    lockService.tryWriteLockAndRun = jest.fn((params, callback) => callback());
  });

  describe('create function', () => {
    // ** This function has no input validation **
    it('should fail because a permission record already exists', async () => {
      // BUILD
      const context = { principalIdentifier: { uid: 'u-daffyduck' } };

      dbService.table.update.mockImplementationOnce(() => {
        throw error;
      });

      // OPERATE
      try {
        await service.create(context, 'porkypig');
        expect.hasAssertions();
      } catch (err) {
        expect(err.message).toEqual('Permission record for study with id "Study:porkypig" already exists');
      }
    });

    it('should try to create a study permission for new write permissions', async () => {
      // BUILD
      const context = { principalIdentifier: { uid: 'u-elmerfudd' } };

      const retVal = {
        id: 'Study:bugsbunny',
        recordType: 'study',
        adminUsers: [context.principalIdentifier.uid],
        readonlyUsers: [],
        writeonlyUsers: [],
        readwriteUsers: [],
        createdBy: context.principalIdentifier.uid,
      };

      const studyPermissionRecord = {
        id: 'Study:bugsbunny',
        recordType: 'study',
        adminUsers: [context.principalIdentifier.uid],
        readonlyUsers: [],
        writeonlyUsers: [],
        readwriteUsers: [],
        createdBy: context.principalIdentifier.uid,
      };

      const userPermissionRecord = {
        id: 'User:u-elmerfudd',
        recordType: 'user',
        uid: context.principalIdentifier.uid,
        adminAccess: ['bugsbunny'],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      dbService.table.update.mockReturnValueOnce(retVal);

      // OPERATE
      const result = await service.create(context, 'bugsbunny');

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-elmerfudd' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'Study:bugsbunny' });
      expect(dbService.table.item).toHaveBeenCalledWith(studyPermissionRecord);
      expect(dbService.table.item).toHaveBeenCalledWith(userPermissionRecord);
      expect(result).toEqual({
        id: 'bugsbunny',
        recordType: undefined,
        adminUsers: [context.principalIdentifier.uid],
        readonlyUsers: [],
        writeonlyUsers: [],
        readwriteUsers: [],
        createdBy: context.principalIdentifier.uid,
      });
    });

    it('should try to create a study permission', async () => {
      // BUILD
      const context = { principalIdentifier: { uid: 'u-elmerfudd' } };

      const retVal = {
        id: 'Study:bugsbunny',
        recordType: 'study',
        adminUsers: [context.principalIdentifier.uid],
        readonlyUsers: [],
        createdBy: context.principalIdentifier.uid,
      };

      dbService.table.update.mockReturnValueOnce(retVal);
      // OPERATE
      const result = await service.create(context, 'Study: bugsbunny');

      // CHECK
      expect(result).toEqual({
        id: 'bugsbunny',
        recordType: undefined,
        adminUsers: [context.principalIdentifier.uid],
        readonlyUsers: [],
        createdBy: context.principalIdentifier.uid,
      });
    });
  });

  describe('update function', () => {
    it('should fail due to missing permissionLevel value', async () => {
      // BUILD
      const user = {
        uid: 'u-yosemitesam',
      };

      const updateRequest = {
        usersToAdd: [user],
        userToRemove: [],
      };

      // OPERATE
      try {
        await service.update({}, 'studyId', updateRequest);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Input has validation errors');
      }
    });

    it('should fail because all admins were removed', async () => {
      // BUILD
      const user1 = {
        uid: 'u-tweetybird',
        permissionLevel: 'readonly',
      };

      const user2 = {
        uid: 'u-porkypig',
        permissionLevel: 'admin',
      };

      const updateRequest = {
        usersToAdd: [user1],
        usersToRemove: [user2],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        adminUsers: [user2.uid],
        readonlyUsers: [],
      });

      // OPERATE
      try {
        await service.update({ user2 }, 'studyId', updateRequest);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('At least one Admin must be assigned to the study');
      }
    });

    it('should succeed', async () => {
      // BUILD
      const user1 = {
        uid: 'u-someUserId',
        permissionLevel: 'readonly',
      };

      const updateRequest = {
        usersToAdd: [user1],
        usersToRemove: [],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyEXAMPLE',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'study:EXAMPLE',
        recordType: 'TEST',
        adminUsers: ['u-someAdminUserId'],
        readonlyUsers: ['u-someUserId'],
      });

      // OPERATE
      const res = await service.update({}, 'studyId', updateRequest);

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
      expect(res).toMatchObject({ id: 'EXAMPLE' });
    });

    it('update permissions should fail if same user is specified multiple non-admin permissions', async () => {
      // BUILD
      const multiplePermissionsUserWithReadOnly = {
        uid: 'u-speedygonzales.looneytunes.multiple',
        permissionLevel: 'readonly',
      };

      const multiplePermissionsUserWithWriteOnly = {
        uid: 'u-speedygonzales.looneytunes.multiple',
        permissionLevel: 'writeonly',
      };

      const readonlyuser = {
        uid: 'u-speedygonzales.looneytunes.readonly',
        permissionLevel: 'readonly',
      };

      const readwriteuser = {
        uid: 'u-speedygonzales.looneytunes.readwrite',
        permissionLevel: 'readwrite',
      };

      const writeonlyuser = {
        uid: 'u-speedygonzales.looneytunes.writeonly',
        permissionLevel: 'writeonly',
      };

      const updateRequest = {
        usersToAdd: [
          readonlyuser,
          readwriteuser,
          writeonlyuser,
          multiplePermissionsUserWithWriteOnly,
          multiplePermissionsUserWithReadOnly,
        ],
        usersToRemove: [],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'Study:studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: ['u-speedygonzales.readonly'],
        writeonlyUsers: ['u-speedygonzales.writeonly'],
        readwriteUsers: ['u-speedygonzales.readwrite'],
      });

      // OPERATE
      try {
        await service.update({}, 'studyId', updateRequest);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(
          'User u-speedygonzales.looneytunes.multiple cannot have multiple permissions: readonly,writeonly',
        );
      }
    });

    it('update permissions for study with multiple admins', async () => {
      // BUILD
      const admin1 = {
        uid: 'u-speedygonzales.admin1',
        permissionLevel: 'admin',
      };

      const admin2 = {
        uid: 'u-speedygonzales.admin2',
        permissionLevel: 'admin',
      };

      const writeonlyadmin = {
        uid: 'u-speedygonzales.admin1',
        permissionLevel: 'writeonly',
      };

      const updateRequest = {
        usersToAdd: [admin1, admin2, writeonlyadmin],
        usersToRemove: [],
      };

      const studyPermissionRecord = {
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd', 'u-speedygonzales.admin1', 'u-speedygonzales.admin2'],
        readonlyUsers: [],
        updatedBy: undefined,
        writeonlyUsers: ['u-speedygonzales.admin1'],
        readwriteUsers: [],
      };

      const admin1UserPermission = {
        id: 'User:u-speedygonzales.admin1',
        recordType: 'user',
        uid: 'u-speedygonzales.admin1',
        adminAccess: ['studyId'],
        readonlyAccess: [],
        writeonlyAccess: ['studyId'],
        readwriteAccess: [],
      };

      const admin2UserPermission = {
        id: 'User:u-speedygonzales.admin2',
        recordType: 'user',
        uid: 'u-speedygonzales.admin2',
        adminAccess: ['studyId'],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: [],
      });

      service.findByUser = jest.fn().mockImplementation((_, key) => {
        switch (key) {
          case 'u-speedygonzales.admin1':
            return {
              id: 'User:u-speedygonzales.admin1',
              recordType: 'user',
              uid: 'u-speedygonzales.admin1',
              adminAccess: ['studyId'],
              readonlyAccess: [],
              writeonlyAccess: [],
              readwriteAccess: [],
            };
          default:
            return undefined;
        }
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'Study:studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd', 'u-speedygonzales.admin1', 'u-speedygonzales.admin2'],
        readonlyUsers: [],
        writeonlyUsers: ['u-speedygonzales.admin1'],
        readwriteUsers: [],
      });

      // OPERATE
      const res = await service.update({}, 'studyId', updateRequest);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.admin1' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.admin2' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'Study:studyId' });
      expect(dbService.table.item).toHaveBeenCalledWith(studyPermissionRecord);
      expect(dbService.table.item).toHaveBeenCalledWith(admin1UserPermission);
      expect(dbService.table.item).toHaveBeenCalledWith(admin2UserPermission);
      expect(dbService.table.update).toHaveBeenCalled();
      expect(res).toMatchObject({ id: 'studyId' });
    });

    it('update permissions for study that switched to readwrite', async () => {
      // BUILD
      const readonlyuser = {
        uid: 'u-speedygonzales.readonly',
        permissionLevel: 'readonly',
      };

      const readwriteuser = {
        uid: 'u-speedygonzales.readwrite',
        permissionLevel: 'readwrite',
      };

      const writeonlyuser = {
        uid: 'u-speedygonzales.writeonly',
        permissionLevel: 'writeonly',
      };

      const updateRequest = {
        usersToAdd: [readonlyuser, readwriteuser, writeonlyuser],
        usersToRemove: [],
      };

      const studyPermissionRecord = {
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: ['u-speedygonzales.readonly'],
        updatedBy: undefined,
        writeonlyUsers: ['u-speedygonzales.writeonly'],
        readwriteUsers: ['u-speedygonzales.readwrite'],
      };

      const readOnlyUserPermission = {
        id: 'User:u-speedygonzales.readonly',
        recordType: 'user',
        uid: 'u-speedygonzales.readonly',
        adminAccess: [],
        readonlyAccess: ['studyId'],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      const writeOnlyUserPermission = {
        id: 'User:u-speedygonzales.writeonly',
        recordType: 'user',
        uid: 'u-speedygonzales.writeonly',
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: ['studyId'],
        readwriteAccess: [],
      };

      const readWriteUserPermission = {
        id: 'User:u-speedygonzales.readwrite',
        recordType: 'user',
        uid: 'u-speedygonzales.readwrite',
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: ['studyId'],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'Study:studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: ['u-speedygonzales.readonly'],
        writeonlyUsers: ['u-speedygonzales.writeonly'],
        readwriteUsers: ['u-speedygonzales.readwrite'],
      });

      // OPERATE
      const res = await service.update({}, 'studyId', updateRequest);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.writeonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.readonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.readwrite' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'Study:studyId' });
      expect(dbService.table.item).toHaveBeenCalledWith(studyPermissionRecord);
      expect(dbService.table.item).toHaveBeenCalledWith(readOnlyUserPermission);
      expect(dbService.table.item).toHaveBeenCalledWith(readWriteUserPermission);
      expect(dbService.table.item).toHaveBeenCalledWith(writeOnlyUserPermission);
      expect(dbService.table.update).toHaveBeenCalled();
      expect(res).toMatchObject({ id: 'studyId' });
    });

    it('remove permissions for readwrite users', async () => {
      // BUILD
      const readonlyuser = {
        uid: 'u-speedygonzales.readonly',
        permissionLevel: 'readonly',
      };

      const readwriteuser = {
        uid: 'u-speedygonzales.readwrite',
        permissionLevel: 'readwrite',
      };

      const writeonlyuser = {
        uid: 'u-speedygonzales.writeonly',
        permissionLevel: 'writeonly',
      };

      const updateRequest = {
        usersToAdd: [readonlyuser],
        usersToRemove: [readwriteuser, writeonlyuser],
      };

      const studyPermissionRecord = {
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: ['u-speedygonzales.readonly'],
        updatedBy: undefined,
        writeonlyUsers: [],
        readwriteUsers: [],
      };

      const readOnlyUserPermission = {
        id: 'User:u-speedygonzales.readonly',
        recordType: 'user',
        uid: 'u-speedygonzales.readonly',
        adminAccess: [],
        readonlyAccess: ['studyId'],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      const writeOnlyUserPermissionRemoved = {
        id: 'User:u-speedygonzales.writeonly',
        recordType: 'user',
        uid: 'u-speedygonzales.writeonly',
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      const readWriteUserPermissionRemoved = {
        id: 'User:u-speedygonzales.readwrite',
        recordType: 'user',
        uid: 'u-speedygonzales.readwrite',
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'Study:studyId',
        recordType: 'TEST',
        adminUsers: ['u-efudd'],
        readonlyUsers: ['u-speedygonzales.readonly'],
        writeonlyUsers: ['u-speedygonzales.writeonly'],
        readwriteUsers: ['u-speedygonzales.readwrite'],
      });

      // OPERATE
      const res = await service.update({}, 'studyId', updateRequest);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.writeonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.readonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:u-speedygonzales.readwrite' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'Study:studyId' });
      expect(dbService.table.item).toHaveBeenCalledWith(studyPermissionRecord);
      expect(dbService.table.item).toHaveBeenCalledWith(readOnlyUserPermission);
      expect(dbService.table.item).toHaveBeenCalledWith(readWriteUserPermissionRemoved);
      expect(dbService.table.item).toHaveBeenCalledWith(writeOnlyUserPermissionRemoved);
      expect(dbService.table.update).toHaveBeenCalled();
      expect(res).toMatchObject({ id: 'studyId' });
    });
  });

  describe('delete function', () => {
    it('passes', async () => {
      // BUILD
      const user1 = {
        uid: 'u-foghorn',
        permissionLevel: 'admin',
      };
      const user2 = {
        uid: 'u-tweety',
        permissionLevel: 'readonly',
      };
      const studyRecord = {
        adminUsers: [user1],
        readonlyUsers: [user2],
      };

      lockService.getLockKey = jest.fn();
      service.findByStudy = jest.fn().mockResolvedValueOnce(studyRecord);
      dbService.table.delete.mockResolvedValueOnce({ id: 'study:DELETETEST', recordType: 'extraneous' });
      service.upsertUserRecord = jest.fn();

      await service.delete(studyRecord, 'exampleStudyId');
      expect(service.upsertUserRecord).toHaveBeenCalledTimes(2);
      expect(dbService.table.delete).toHaveBeenCalled();
    });

    it('delete study with accessType defined as readwrite', async () => {
      // BUILD
      const adminUser = {
        uid: 'u-foghorn',
        permissionLevel: 'admin',
      };
      const writeOnlyUser = {
        uid: 'u-tweety.writeonly',
        permissionLevel: 'writeonly',
      };
      const readWriteUser = {
        uid: 'u-tweety.readwrite',
        permissionLevel: 'readwrite',
      };
      const studyRecord = {
        adminUsers: [adminUser],
        readonlyUsers: [],
        writeonlyUsers: [writeOnlyUser],
        readwriteUsers: [readWriteUser],
      };

      lockService.getLockKey = jest.fn();
      service.findByStudy = jest.fn().mockResolvedValueOnce(studyRecord);
      dbService.table.delete.mockResolvedValueOnce({ id: 'study:DELETETEST', recordType: 'extraneous' });
      service.upsertUserRecord = jest.fn();

      await service.delete(studyRecord, 'exampleStudyId');
      expect(service.upsertUserRecord).toHaveBeenCalledTimes(3);
      expect(dbService.table.delete).toHaveBeenCalled();
    });
  });

  describe('verify requestor access', () => {
    it('admin should have UPLOAD access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: ['studyId'],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'UPLOAD');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('admin should have GET access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: ['studyId'],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'GET');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('admin should have PUT access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales.admin1' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales.admin1',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: ['studyId'],
        readonlyAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'PUT');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('writeonly user should have UPLOAD access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: ['studyId'],
        readwriteAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'UPLOAD');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('writeonly user should have GET access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: ['studyId'],
        readwriteAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'GET');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('writeonly user should not have PUT access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: ['studyId'],
        readwriteAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      try {
        await service.verifyRequestorAccess(request, 'studyId', 'PUT');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('');
      }
    });

    it('readwrite user should have UPLOAD access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: ['studyId'],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'UPLOAD');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('readwrite user should have GET access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: ['studyId'],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'GET');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('readwrite user should not have PUT access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: ['studyId'],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      try {
        await service.verifyRequestorAccess(request, 'studyId', 'PUT');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('');
      }
    });

    it('readonly user should not have UPLOAD access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: ['studyId'],
        writeonlyAccess: [],
        readwriteAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      try {
        await service.verifyRequestorAccess(request, 'studyId', 'UPLOAD');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('');
      }
    });

    it('readonly user should have GET access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: ['studyId'],
        writeonlyAccess: [],
        readwriteAccess: [],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      await service.verifyRequestorAccess(request, 'studyId', 'GET');
      expect(service.findByUser).toHaveBeenCalled();
    });

    it('readonly user should not have PUT access', async () => {
      // BUILD
      const request = { principalIdentifier: { uid: 'u-speedygonzales' } };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:u-u-speedygonzales',
        recordType: 'user',
        uid: request.principalIdentifier.uid,
        adminAccess: [],
        readonlyAccess: ['studyId'],
      });

      lockService.getLockKey = jest.fn();

      // OPERATE
      try {
        await service.verifyRequestorAccess(request, 'studyId', 'PUT');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('');
      }
    });

    it('invalid action', async () => {
      // OPERATE
      try {
        await service.verifyRequestorAccess({}, 'studyId', 'GARBAGE');
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual('Invalid action passed to verifyRequestorAccess(): GARBAGE');
      }
    });
  });
});
