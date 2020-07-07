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
  });
});
