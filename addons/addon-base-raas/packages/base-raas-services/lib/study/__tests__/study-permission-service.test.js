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
      const context = {
        principalIdentifier: {
          username: 'daffyduck',
          ns: 'daffyduck.ltunes',
        },
      };

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
      const context = {
        principalIdentifier: {
          username: 'elmerfudd',
          ns: 'elmerfudd.ltunes',
        },
      };

      const retVal = {
        id: 'Study:bugsbunny',
        recordType: 'study',
        adminUsers: [context.principalIdentifier],
        readonlyUsers: [],
        writeonlyUsers: [],
        readwriteUsers: [],
        createdBy: context.principalIdentifier,
      };

      const studyPermissionRecord = {
        id: 'Study:bugsbunny',
        recordType: 'study',
        adminUsers: [context.principalIdentifier],
        readonlyUsers: [],
        writeonlyUsers: [],
        readwriteUsers: [],
        createdBy: context.principalIdentifier,
      };

      const userPermissionRecord = {
        id: 'User:elmerfudd',
        recordType: 'user',
        principalIdentifier: context.principalIdentifier,
        adminAccess: ['bugsbunny'],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      dbService.table.update.mockReturnValueOnce(retVal);

      // OPERATE
      const result = await service.create(context, 'bugsbunny');

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:elmerfudd' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'Study:bugsbunny' });
      expect(dbService.table.item).toHaveBeenCalledWith(studyPermissionRecord);
      expect(dbService.table.item).toHaveBeenCalledWith(userPermissionRecord);
      expect(result).toEqual({
        id: 'bugsbunny',
        recordType: undefined,
        adminUsers: [context.principalIdentifier],
        readonlyUsers: [],
        writeonlyUsers: [],
        readwriteUsers: [],
        createdBy: context.principalIdentifier,
      });
    });

    it('should try to create a study permission', async () => {
      // BUILD
      const context = {
        principalIdentifier: {
          username: 'elmerfudd',
          ns: 'elmerfudd.ltunes',
        },
      };

      const retVal = {
        id: 'Study:bugsbunny',
        recordType: 'study',
        adminUsers: [context.principalIdentifier],
        readonlyUsers: [],
        createdBy: context.principalIdentifier,
      };

      dbService.table.update.mockReturnValueOnce(retVal);
      // OPERATE
      const result = await service.create(context, 'Study: bugsbunny');

      // CHECK
      expect(result).toEqual({
        id: 'bugsbunny',
        recordType: undefined,
        adminUsers: [context.principalIdentifier],
        readonlyUsers: [],
        createdBy: context.principalIdentifier,
      });
    });
  });

  describe('update function', () => {
    it('should fail due to missing permissionLevel value', async () => {
      // BUILD
      const user = {
        principalIdentifier: {
          ns: 'yosemitesam.looneytunes',
          username: 'yosemitesam',
        },
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
        principalIdentifier: {
          ns: 'tweetybird.looneytunes',
          username: 'tweetybird',
        },
        permissionLevel: 'readonly',
      };

      const user2 = {
        principalIdentifier: {
          ns: 'porkypig.looneytunes',
          username: 'porkypig',
        },
        permissionLevel: 'admin',
      };

      const updateRequest = {
        usersToAdd: [user1],
        usersToRemove: [user2],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        adminUsers: [{ ns: user2.principalIdentifier.ns, username: user2.principalIdentifier.username }],
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
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
        permissionLevel: 'readonly',
      };

      const updateRequest = {
        usersToAdd: [user1],
        usersToRemove: [],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyEXAMPLE',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'study:EXAMPLE',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [{ ns: 'speedygonzales.looneytunes', username: 'speedygonzales' }],
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
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.multiple',
          username: 'speedygonzales.multiple',
        },
        permissionLevel: 'readonly',
      };

      const multiplePermissionsUserWithWriteOnly = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.multiple',
          username: 'speedygonzales.multiple',
        },
        permissionLevel: 'writeonly',
      };

      const readonlyuser = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readonly',
          username: 'speedygonzales.readonly',
        },
        permissionLevel: 'readonly',
      };

      const readwriteuser = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readwrite',
          username: 'speedygonzales.readwrite',
        },
        permissionLevel: 'readwrite',
      };

      const writeonlyuser = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.writeonly',
          username: 'speedygonzales.writeonly',
        },
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
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'Study:studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [{ ns: 'speedygonzales.looneytunes.readonly', username: 'speedygonzales.readonly' }],
        writeonlyUsers: [{ ns: 'speedygonzales.looneytunes.writeonly', username: 'speedygonzales.writeonly' }],
        readwriteUsers: [{ ns: 'speedygonzales.looneytunes.readwrite', username: 'speedygonzales.readwrite' }],
      });

      // OPERATE
      try {
        await service.update({}, 'studyId', updateRequest);
        expect.hasAssertions();
      } catch (err) {
        // CHECK
        expect(err.message).toEqual(
          'User speedygonzales.multiple cannot have multiple permissions: readonly,writeonly',
        );
      }
    });

    it('update permissions for study with multiple admins', async () => {
      // BUILD
      const admin1 = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.admin1',
          username: 'speedygonzales.admin1',
        },
        permissionLevel: 'admin',
      };

      const admin2 = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.admin2',
          username: 'speedygonzales.admin2',
        },
        permissionLevel: 'admin',
      };

      const writeonlyadmin = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.admin1',
          username: 'speedygonzales.admin1',
        },
        permissionLevel: 'writeonly',
      };

      const updateRequest = {
        usersToAdd: [admin1, admin2, writeonlyadmin],
        usersToRemove: [],
      };

      const studyPermissionRecord = {
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: [
          { ns: 'efudd.looneytunes', username: 'efudd' },
          { ns: 'speedygonzales.looneytunes.admin1', username: 'speedygonzales.admin1' },
          { ns: 'speedygonzales.looneytunes.admin2', username: 'speedygonzales.admin2' },
        ],
        readonlyUsers: [],
        updatedBy: undefined,
        writeonlyUsers: [
          {
            ns: 'speedygonzales.looneytunes.admin1',
            username: 'speedygonzales.admin1',
          },
        ],
        readwriteUsers: [],
      };

      const admin1UserPermission = {
        id: 'User:speedygonzales.admin1',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.admin1',
          username: 'speedygonzales.admin1',
        },
        adminAccess: ['studyId'],
        readonlyAccess: [],
        writeonlyAccess: ['studyId'],
        readwriteAccess: [],
      };

      const admin2UserPermission = {
        id: 'User:speedygonzales.admin2',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.admin2',
          username: 'speedygonzales.admin2',
        },
        adminAccess: ['studyId'],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [],
      });

      service.findByUser = jest.fn().mockImplementation((_, key) => {
        switch (key) {
          case 'speedygonzales.admin1':
            return {
              id: 'User:speedygonzales.admin1',
              recordType: 'user',
              principalIdentifier: {
                ns: 'speedygonzales.looneytunes.admin1',
                username: 'speedygonzales.admin1',
              },
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
        adminUsers: [
          { ns: 'efudd.looneytunes', username: 'efudd' },
          { ns: 'speedygonzales.looneytunes.admin1', username: 'speedygonzales.admin1' },
          { ns: 'speedygonzales.looneytunes.admin2', username: 'speedygonzales.admin2' },
        ],
        readonlyUsers: [],
        writeonlyUsers: [{ ns: 'speedygonzales.looneytunes.admin1', username: 'speedygonzales.admin1' }],
        readwriteUsers: [],
      });

      // OPERATE
      const res = await service.update({}, 'studyId', updateRequest);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.admin1' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.admin2' });
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
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readonly',
          username: 'speedygonzales.readonly',
        },
        permissionLevel: 'readonly',
      };

      const readwriteuser = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readwrite',
          username: 'speedygonzales.readwrite',
        },
        permissionLevel: 'readwrite',
      };

      const writeonlyuser = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.writeonly',
          username: 'speedygonzales.writeonly',
        },
        permissionLevel: 'writeonly',
      };

      const updateRequest = {
        usersToAdd: [readonlyuser, readwriteuser, writeonlyuser],
        usersToRemove: [],
      };

      const studyPermissionRecord = {
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [
          {
            ns: 'speedygonzales.looneytunes.readonly',
            username: 'speedygonzales.readonly',
          },
        ],
        updatedBy: undefined,
        writeonlyUsers: [
          {
            ns: 'speedygonzales.looneytunes.writeonly',
            username: 'speedygonzales.writeonly',
          },
        ],
        readwriteUsers: [
          {
            ns: 'speedygonzales.looneytunes.readwrite',
            username: 'speedygonzales.readwrite',
          },
        ],
      };

      const readOnlyUserPermission = {
        id: 'User:speedygonzales.readonly',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readonly',
          username: 'speedygonzales.readonly',
        },
        adminAccess: [],
        readonlyAccess: ['studyId'],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      const writeOnlyUserPermission = {
        id: 'User:speedygonzales.writeonly',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.writeonly',
          username: 'speedygonzales.writeonly',
        },
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: ['studyId'],
        readwriteAccess: [],
      };

      const readWriteUserPermission = {
        id: 'User:speedygonzales.readwrite',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readwrite',
          username: 'speedygonzales.readwrite',
        },
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: ['studyId'],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'Study:studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [{ ns: 'speedygonzales.looneytunes.readonly', username: 'speedygonzales.readonly' }],
        writeonlyUsers: [{ ns: 'speedygonzales.looneytunes.writeonly', username: 'speedygonzales.writeonly' }],
        readwriteUsers: [{ ns: 'speedygonzales.looneytunes.readwrite', username: 'speedygonzales.readwrite' }],
      });

      // OPERATE
      const res = await service.update({}, 'studyId', updateRequest);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.writeonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.readonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.readwrite' });
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
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readonly',
          username: 'speedygonzales.readonly',
        },
        permissionLevel: 'readonly',
      };

      const readwriteuser = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readwrite',
          username: 'speedygonzales.readwrite',
        },
        permissionLevel: 'readwrite',
      };

      const writeonlyuser = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.writeonly',
          username: 'speedygonzales.writeonly',
        },
        permissionLevel: 'writeonly',
      };

      const updateRequest = {
        usersToAdd: [readonlyuser],
        usersToRemove: [readwriteuser, writeonlyuser],
      };

      const studyPermissionRecord = {
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [
          {
            ns: 'speedygonzales.looneytunes.readonly',
            username: 'speedygonzales.readonly',
          },
        ],
        updatedBy: undefined,
        writeonlyUsers: [],
        readwriteUsers: [],
      };

      const readOnlyUserPermission = {
        id: 'User:speedygonzales.readonly',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readonly',
          username: 'speedygonzales.readonly',
        },
        adminAccess: [],
        readonlyAccess: ['studyId'],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      const writeOnlyUserPermissionRemoved = {
        id: 'User:speedygonzales.writeonly',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.writeonly',
          username: 'speedygonzales.writeonly',
        },
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      const readWriteUserPermissionRemoved = {
        id: 'User:speedygonzales.readwrite',
        recordType: 'user',
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.readwrite',
          username: 'speedygonzales.readwrite',
        },
        adminAccess: [],
        readonlyAccess: [],
        writeonlyAccess: [],
        readwriteAccess: [],
      };

      service.findByStudy = jest.fn().mockResolvedValue({
        id: 'studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [],
      });

      dbService.table.update.mockReturnValueOnce({
        id: 'Study:studyId',
        recordType: 'TEST',
        adminUsers: [{ ns: 'efudd.looneytunes', username: 'efudd' }],
        readonlyUsers: [{ ns: 'speedygonzales.looneytunes.readonly', username: 'speedygonzales.readonly' }],
        writeonlyUsers: [{ ns: 'speedygonzales.looneytunes.writeonly', username: 'speedygonzales.writeonly' }],
        readwriteUsers: [{ ns: 'speedygonzales.looneytunes.readwrite', username: 'speedygonzales.readwrite' }],
      });

      // OPERATE
      const res = await service.update({}, 'studyId', updateRequest);

      // CHECK
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.writeonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.readonly' });
      expect(dbService.table.key).toHaveBeenCalledWith({ id: 'User:speedygonzales.readwrite' });
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
        principalIdentifier: {
          username: 'foghorn',
          ns: 'foghorn.leghorn',
        },
        permissionLevel: 'admin',
      };
      const user2 = {
        principalIdentifier: {
          username: 'tweety',
          ns: 'tweety.bird',
        },
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
        principalIdentifier: {
          username: 'foghorn',
          ns: 'foghorn.leghorn',
        },
        permissionLevel: 'admin',
      };
      const writeOnlyUser = {
        principalIdentifier: {
          username: 'tweety.writeonly',
          ns: 'tweety.bird.writeonly',
        },
        permissionLevel: 'writeonly',
      };
      const readWriteUser = {
        principalIdentifier: {
          username: 'tweety.readwrite',
          ns: 'tweety.bird.readwrite',
        },
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes.admin1',
          username: 'speedygonzales.admin1',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales.admin1',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
      const request = {
        principalIdentifier: {
          ns: 'speedygonzales.looneytunes',
          username: 'speedygonzales',
        },
      };
      service.findByUser = jest.fn().mockResolvedValue({
        id: 'User:speedygonzales',
        recordType: 'user',
        principalIdentifier: request.principalIdentifier,
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
