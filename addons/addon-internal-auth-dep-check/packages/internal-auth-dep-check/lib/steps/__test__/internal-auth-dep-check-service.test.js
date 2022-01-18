/* eslint-disable no-console */
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
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const Logger = require('@aws-ee/base-services/lib/logger/logger-service');

jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

const InternalAuthDepCheckService = require('../internal-auth-dep-check-service');

describe('InternalAuthDepCheckService', () => {
  let service;
  let dbService;
  let container;
  let settings;

  const listOfInternalUsers = ['u-internal'];

  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    container.register('log', new Logger());
    container.register('dbService', new DbServiceMock());
    container.register('InternalAuthDepCheckService', new InternalAuthDepCheckService());
    container.register('settings', new SettingsServiceMock());
    console.info = jest.fn;

    await container.initServices();
    service = await container.find('InternalAuthDepCheckService');
    dbService = await container.find('dbService');
    service.dbService = dbService;

    settings = await container.find('settings');
    settings.get = jest.fn(key => {
      if (key === 'dbKeyPairs') {
        return 'dbKeyPairs';
      }
      if (key === 'dbUsers') {
        return 'dbUsers';
      }
      if (key === 'dbProjects') {
        return 'dbProjects';
      }
      if (key === 'dbStudies') {
        return 'dbStudies';
      }
      if (key === 'dbStudyPermissions') {
        return 'dbStudyPermissions';
      }
      if (key === 'dbEnvironmentsSc') {
        return 'dbEnvironmentsSc';
      }
      return undefined;
    });

    // suppress expected console errors
    jest.spyOn(console, 'error').mockImplementation();
  });

  describe('verifyInternalUserWorkspacesAreTerminated', () => {
    it('should return false when internal user workspaces are not terminated or failed', async () => {
      // BUILD
      service.dbService.table.scan = jest
        .fn()
        .mockResolvedValueOnce([{ id: 'someWorkspace', createdBy: 'u-internal' }]);

      // OPERATE
      const result = await service.verifyInternalUserWorkspacesAreTerminated(listOfInternalUsers);

      // CHECK
      expect(result).toBeFalsy();
    });

    it('should return true when internal user workspaces are all terminated or failed', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ id: 'someWorkspace', createdBy: 'u-cognito' }]);

      // OPERATE
      const result = await service.verifyInternalUserWorkspacesAreTerminated(listOfInternalUsers);

      // CHECK
      expect(result).toBeTruthy();
    });
  });

  describe('verifyNoInternalUserSSHKey', () => {
    it('should return false when active SSH keys are linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ uid: 'u-internal' }]);

      // OPERATE
      const result = await service.verifyNoInternalUserSSHKey(listOfInternalUsers);

      // CHECK
      expect(result).toBeFalsy();
    });

    it('should return true when active SSH keys are not linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ uid: 'u-cognito' }]);

      // OPERATE
      const result = await service.verifyNoInternalUserSSHKey(listOfInternalUsers);

      // CHECK
      expect(result).toBeTruthy();
    });
  });

  describe('_listInternalUsers', () => {
    it('should return two lists of the uids and statuses', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ uid: 'u-internal', status: 'active' }]);
      const expectedResult = { listOfInternalUsers: ['u-internal'], listOfInternalStatuses: ['active'] };

      // OPERATE
      const result = await service._listInternalUsers();

      // CHECK
      expect(result).toEqual(expectedResult);
    });
  });

  describe('verifyNoActiveInternalUsers', () => {
    it('should return false when there are active internal users', async () => {
      // BUILD
      const listOfInternalStatuses = ['active', 'inactive'];

      // OPERATE
      const result = await service.verifyNoActiveInternalUsers(listOfInternalStatuses);

      // CHECK
      expect(result).toBeFalsy();
    });

    it('should return true when there are not active internal users', async () => {
      // BUILD
      const listOfInternalStatuses = ['inactive'];

      // OPERATE
      const result = await service.verifyNoActiveInternalUsers(listOfInternalStatuses);

      // CHECK
      expect(result).toBeTruthy();
    });
  });

  describe('verifyNoInternalUserProjects', () => {
    it('should return false when Projects are linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ projectAdmins: ['u-internal'] }]);

      // OPERATE
      const result = await service.verifyNoInternalUserProjects(listOfInternalUsers);

      // CHECK
      expect(result).toBeFalsy();
    });

    it('should return true when Projects are not linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ projectAdmins: ['u-cognito'] }]);

      // OPERATE
      const result = await service.verifyNoInternalUserProjects(listOfInternalUsers);

      // CHECK
      expect(result).toBeTruthy();
    });
  });

  describe('verifyNoInternalUserOrgStudies', () => {
    it('should return false when Organization studies are linked internal users in study table entry', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ id: 'org-study-1' }]);
      service.dbService.table.query = jest
        .fn()
        .mockResolvedValueOnce([
          { adminUsers: ['u-internal'], readonlyUsers: [], readwriteUsers: [], writeonlyUsers: [] },
        ]);

      // OPERATE
      const result = await service.verifyNoInternalUserOrgStudies(listOfInternalUsers);

      // CHECK
      expect(result).toBeFalsy();
    });

    it('should return false when Organization studies are linked internal users in user table entry', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ id: 'org-study-1' }]);
      service.dbService.table.query = jest
        .fn()
        .mockResolvedValueOnce([{ adminUsers: [], readonlyUsers: [], readwriteUsers: [], writeonlyUsers: [] }])
        .mockResolvedValueOnce([
          { adminAccess: ['org-study-1'], readonlyAccess: [], readwriteAccess: [], writeonlyAccess: [] },
        ]);

      // OPERATE
      const result = await service.verifyNoInternalUserOrgStudies(listOfInternalUsers);

      // CHECK
      expect(result).toBeFalsy();
    });

    it('should return true when Organization studies are not linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ id: 'org-study-1' }]);
      service.dbService.table.query = jest
        .fn()
        .mockResolvedValueOnce([
          { adminUsers: ['u-cognito'], readonlyUsers: [], readwriteUsers: [], writeonlyUsers: [] },
        ])
        .mockResolvedValueOnce([{ adminAccess: [], readonlyAccess: [], readwriteAccess: [], writeonlyAccess: [] }]);

      // OPERATE
      const result = await service.verifyNoInternalUserOrgStudies(listOfInternalUsers);

      // CHECK
      expect(result).toBeTruthy();
    });
  });
});
