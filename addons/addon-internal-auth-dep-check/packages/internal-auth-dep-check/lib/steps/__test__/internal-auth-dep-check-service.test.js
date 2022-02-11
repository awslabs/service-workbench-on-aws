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

jest.mock('@aws-ee/base-services/lib/user/user-service');
const UserServiceMock = require('@aws-ee/base-services/lib/user/user-service');

const InternalAuthDepCheckService = require('../internal-auth-dep-check-service');

describe('InternalAuthDepCheckService', () => {
  let service;
  let dbService;
  let userService;
  let container;
  let settings;

  const listOfInternalUsers = ['u-internal'];
  const listOfInternalUsernames = { 'u-internal': 'internal@amazon.com' };

  beforeEach(async () => {
    // Initialize services container and register dependencies
    container = new ServicesContainer();
    container.register('log', new Logger());
    container.register('dbService', new DbServiceMock());
    container.register('userService', new UserServiceMock());
    container.register('InternalAuthDepCheckService', new InternalAuthDepCheckService());
    container.register('settings', new SettingsServiceMock());
    console.info = jest.fn;

    await container.initServices();
    service = await container.find('InternalAuthDepCheckService');

    dbService = await container.find('dbService');
    service.dbService = dbService;

    userService = await container.find('userService');
    service.userService = userService;

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

  describe('execute', () => {
    it('should skip check on fresh install', async () => {
      // BUILD
      service.dbService.describeTable = jest.fn().mockRejectedValueOnce({ code: 'ResourceNotFoundException' });
      service._listInternalUsers = jest.fn();

      // OPERATE n CHECK it didn't get past the try catch block
      expect(service._listInternalUsers).not.toHaveBeenCalled();
    });
  });

  describe('verifyInternalUserWorkspacesAreTerminated', () => {
    it('should return false when internal user workspaces are not terminated or failed', async () => {
      // BUILD
      service.dbService.table.scan = jest
        .fn()
        .mockResolvedValueOnce([{ id: 'someWorkspace', createdBy: 'u-internal' }]);
      const expected = [
        'Terminate the following workspaces owned by internal users:',
        'someWorkspace owned by user u-internal (internal@amazon.com)',
      ];

      // OPERATE
      const result = await service.verifyInternalUserWorkspacesAreTerminated(
        listOfInternalUsers,
        listOfInternalUsernames,
      );

      // CHECK
      expect(result).toEqual(expected);
    });

    it('should return true when internal user workspaces are all terminated or failed', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ id: 'someWorkspace', createdBy: 'u-cognito' }]);
      const expected = [];

      // OPERATE
      const result = await service.verifyInternalUserWorkspacesAreTerminated(
        listOfInternalUsers,
        listOfInternalUsernames,
      );

      // CHECK
      expect(result).toEqual(expected);
    });
  });

  describe('verifyNoInternalUserSSHKey', () => {
    it('should return false when active SSH keys are linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ uid: 'u-internal', id: 'somekeyid' }]);
      const expected = [
        'Deactivate the following SSH Keys owned by internal users:',
        'somekeyid owned by user u-internal (internal@amazon.com)',
      ];

      // OPERATE
      const result = await service.verifyNoInternalUserSSHKey(listOfInternalUsers, listOfInternalUsernames);

      // CHECK
      expect(result).toEqual(expected);
    });

    it('should return true when active SSH keys are not linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ uid: 'u-cognito' }]);
      const expected = [];

      // OPERATE
      const result = await service.verifyNoInternalUserSSHKey(listOfInternalUsers, listOfInternalUsernames);

      // CHECK
      expect(result).toEqual(expected);
    });
  });

  describe('_listInternalUsers', () => {
    it('should return two lists of the uids and statuses', async () => {
      // BUILD
      service.dbService.table.scan = jest
        .fn()
        .mockResolvedValueOnce([{ uid: 'u-internal', status: 'active', projectId: ['someProject', 'otherProject'] }]);
      service.getUserNames = jest.fn().mockImplementationOnce(() => {
        return { 'u-internal': 'internal@amazon.com' };
      });
      const expectedResult = {
        listOfInternalUsers: ['u-internal'],
        listOfInternalUsernames: { 'u-internal': 'internal@amazon.com' },
        activeUserBlockers: [
          'Deactivate the following internal users:',
          'u-internal (internal@amazon.com) is still active',
        ],
        internalUserProjectBlockers: [
          'Disassociate the following projects from the following internal users:',
          'someProject,otherProject associated to user u-internal (internal@amazon.com)',
        ],
      };

      // OPERATE
      const result = await service._listInternalUsers();

      // CHECK
      expect(result).toEqual(expectedResult);
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
      const expected = [
        'Disassociate the following organizational studies with internal users:',
        'Found Org Study with internal user permissions: user u-internal (internal@amazon.com) associated with study org-study-1. Contact admin users internal@amazon.com for assistance.',
      ];

      // OPERATE
      const result = await service.verifyNoInternalUserOrgStudies(listOfInternalUsers, listOfInternalUsernames);

      // CHECK
      expect(result).toEqual(expected);
    });

    it('should return true when Organization studies are not linked internal users', async () => {
      // BUILD
      service.dbService.table.scan = jest.fn().mockResolvedValueOnce([{ id: 'org-study-1' }]);
      service.dbService.table.query = jest
        .fn()
        .mockResolvedValueOnce([
          { adminUsers: ['u-cognito'], readonlyUsers: [], readwriteUsers: [], writeonlyUsers: [] },
        ]);
      const expected = [];

      // OPERATE
      const result = await service.verifyNoInternalUserOrgStudies(listOfInternalUsers, listOfInternalUsernames);

      // CHECK
      expect(result).toEqual(expected);
    });
  });
});
