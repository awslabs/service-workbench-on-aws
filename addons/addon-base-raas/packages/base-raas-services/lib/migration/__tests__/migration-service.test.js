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

jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/user/user-service');
const UserServiceMock = require('@aws-ee/base-services/lib/user/user-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');

jest.mock('../../study/study-service');
const StudyServiceMock = require('../../study/study-service');

const MigrationService = require('../migration-service');

jest.mock('../../study/study-operation-service');
const StudyOperationServiceMock = require('../../study/study-operation-service');

const createResearcherContext = ({ uid = 'uid-researcher-1' } = {}) => ({
  principalIdentifier: { uid },
  principal: { userRole: 'researcher', status: 'active' },
});

const createAdminContext = ({ uid = 'uid-admin' } = {}) => ({
  principalIdentifier: { uid },
  principal: { isAdmin: true, userRole: 'admin', status: 'active' },
});

describe('migrationService', () => {
  let service;
  let studyOperationService;
  let settings;
  let dbService;
  let userService;
  let studyService;
  beforeEach(async () => {
    const container = new ServicesContainer();
    container.register('migrationService', new MigrationService());
    container.register('dbService', new DbServiceMock());
    container.register('studyOperationService', new StudyOperationServiceMock());
    container.register('settings', new SettingsServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('studyService', new StudyServiceMock());

    container.initServices();
    service = await container.find('migrationService');
    studyOperationService = await container.find('studyOperationService');
    studyOperationService.updatePermissions = jest.fn((requestContext, studyId, updateRequest) => {
      return {
        projectId: 'sampleProject',
        rev: 0,
        createdAt: '2021-10-26T18:06:55.767Z',
        updatedBy: 'old-internal-user',
        createdBy: 'old-internal-user',
        name: `${studyId}`,
        resources: [
          {
            arn: 'arn:aws:s3:::123456789-stage-solution-sw-studydata/users/old-internal-user/studyName/',
          },
        ],
        updatedAt: '2021-10-26T18:06:55.767Z',
        category: 'My Studies',
        description: 'Test Study',
        id: `${studyId}`,
        uploadLocationEnabled: true,
        status: 'reachable',
        permissions: {
          adminUsers: [`${updateRequest.usersToAdd[0].uid}`],
          readonlyUsers: [],
          readwriteUsers: [],
          writeonlyUsers: [],
          updatedAt: '2022-01-11T19:29:40.831Z',
          createdAt: '2021-10-26T18:06:55.806Z',
          updatedBy: 'old-internal-user',
          createdBy: 'old-internal-user',
        },
      };
    });
    settings = await container.find('settings');
    settings.get = jest.fn(key => {
      if (key === 'dbStudies') {
        return 'dbStudiesTableName';
      }
      if (key === 'dbStudiesCategoryIndex') {
        return 'My Studies';
      }
      return undefined;
    });
    dbService = await container.find('dbService');
    userService = await container.find('userService');
    studyService = await container.find('studyService');
  });

  describe('migrateMyStudiesPermissions', () => {
    it('should produce the same number of defined results as migration requests', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const migrationMapping = [
        { studyId: 'testStudy1', uid: 'testUser1' },
        { studyId: 'testStudy2', uid: 'testUser2' },
      ];

      // OPERATE
      const results = await service.migrateMyStudiesPermissions(requestContext, migrationMapping);

      // CHECK
      expect(results.length).toEqual(migrationMapping.length);
      for (let i = 0; i < migrationMapping.length; i += 1) {
        expect(results[i]).toBeDefined();
      }
    });

    it('should throw error if researcher', async () => {
      // BUILD
      const requestContext = createResearcherContext();
      const migrationMapping = [{ studyId: 'testStudy', uid: 'testUser' }];

      // OPERATE n CHECK
      await expect(service.migrateMyStudiesPermissions(requestContext, migrationMapping)).rejects.toThrow(
        'You need admin permissions to migrate My Studies',
      );
    });

    it('should pass correct updateRequest', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const migrationMapping = [{ studyId: 'testStudy1', uid: 'testUser1' }];

      // OPERATE
      await service.migrateMyStudiesPermissions(requestContext, migrationMapping);

      // CHECK
      expect(studyOperationService.updatePermissions).toHaveBeenCalledWith(requestContext, 'testStudy1', {
        usersToAdd: [{ uid: 'testUser1', permissionLevel: 'admin' }],
        usersToRemove: [{ uid: '*', permissionLevel: 'admin' }],
      });
    });
  });

  describe('listMyStudies', () => {
    it('should throw error if researcher', async () => {
      // BUILD
      const requestContext = createResearcherContext();

      // OPERATE n CHECK
      await expect(service.listMyStudies(requestContext)).rejects.toThrow(
        'You need admin permissions to list all My Studies in this environment',
      );
    });

    it('should output a helpful result when migration is needed', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const expectedResult = [
        { studyId: 'my-study-1', uid: 'u-internal', username: 'internal@amazon.com', authProvider: 'internal' },
        { studyId: 'my-study-2', uid: 'u-internal', username: 'internal@amazon.com', authProvider: 'internal' },
      ];
      dbService.table.query = jest.fn().mockResolvedValueOnce([{ id: 'my-study-1' }, { id: 'my-study-2' }]);
      studyService.getStudyPermissions = jest
        .fn()
        .mockResolvedValueOnce({ permissions: { adminUsers: ['u-internal'] } })
        .mockResolvedValueOnce({ permissions: { adminUsers: ['u-internal'] } });
      userService.findUser = jest
        .fn()
        .mockResolvedValueOnce({ username: 'internal@amazon.com', authenticationProviderId: 'internal' })
        .mockResolvedValueOnce({ username: 'internal@amazon.com', authenticationProviderId: 'internal' });

      // OPERATE
      const result = await service.listMyStudies(requestContext);

      // CHECK
      expect(result).toEqual(expectedResult);
    });

    it('should output a message when migration is not needed', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const expectedResult = [];
      dbService.table.query = jest.fn().mockResolvedValueOnce([{ id: 'my-study-1' }, { id: 'my-study-2' }]);
      studyService.getStudyPermissions = jest
        .fn()
        .mockResolvedValueOnce({ permissions: { adminUsers: ['u-cognito'] } })
        .mockResolvedValueOnce({ permissions: { adminUsers: ['u-cognito'] } });
      userService.findUser = jest
        .fn()
        .mockResolvedValueOnce({ username: 'cognito@amazon.com', authenticationProviderId: 'cognito' })
        .mockResolvedValueOnce({ username: 'cognito@amazon.com', authenticationProviderId: 'cognito' });

      // OPERATE
      const result = await service.listMyStudies(requestContext);

      // CHECK
      expect(result).toEqual(expectedResult);
    });

    it('should filter out internal user-owned studies when migration is needed but some have already been migrated', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const expectedResult = [
        { studyId: 'my-study-2', uid: 'u-internal', username: 'internal@amazon.com', authProvider: 'internal' },
      ];
      dbService.table.query = jest.fn().mockResolvedValueOnce([{ id: 'my-study-1' }, { id: 'my-study-2' }]);
      studyService.getStudyPermissions = jest
        .fn()
        .mockResolvedValueOnce({ permissions: { adminUsers: ['u-cognito'] } })
        .mockResolvedValueOnce({ permissions: { adminUsers: ['u-internal'] } });
      userService.findUser = jest
        .fn()
        .mockResolvedValueOnce({ username: 'cognito@amazon.com', authenticationProviderId: 'cognito' })
        .mockResolvedValueOnce({ username: 'internal@amazon.com', authenticationProviderId: 'internal' });

      // OPERATE
      const result = await service.listMyStudies(requestContext);

      // CHECK
      expect(result).toEqual(expectedResult);
    });
  });
});
