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
      //   console.log(results);

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
        "You don't have permission to migrate My Studies",
      );
    });

    it('should pass correct updateRequest', async () => {
      // BUILD
      const requestContext = createAdminContext();
      const migrationMapping = [{ studyId: 'testStudy1', uid: 'testUser1' }];

      // OPERATE
      await service.migrateMyStudiesPermissions(requestContext, migrationMapping);
      //   console.log(results);

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
        "You don't have permission to list all My Studies in this environment",
      );
    });
  });
});
