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
jest.mock('@aws-ee/base-services/lib/db-service');
const DbServiceMock = require('@aws-ee/base-services/lib/db-service');

jest.mock('@aws-ee/base-services/lib/audit/audit-writer-service');
const AuditWriterServiceMock = require('@aws-ee/base-services/lib/audit/audit-writer-service');

jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');

const ResourceUsageService = require('../resource-usage-service');

// Tested Functions: create, update, delete
describe('IndexesService', () => {
  const requestContext = { principal: { isAdmin: true, status: 'active' } };
  let service = null;
  let dbService = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();
    container.register('dbService', new DbServiceMock());
    container.register('auditWriterService', new AuditWriterServiceMock());
    container.register('resourceUsageService', new ResourceUsageService());
    container.register('settings', new SettingsServiceMock());

    await container.initServices();

    // Get instance of the service we are testing
    dbService = await container.find('dbService');
    service = await container.find('resourceUsageService');
  });

  describe('addUsage', () => {
    it('Add usage to existing entry', async () => {
      // BUILD
      dbService.table.update.mockResolvedValueOnce({ items: ['existItem'] });
      // OPERATE
      const result = await service.addUsage(requestContext, {
        resource: 'resource-name',
        setName: 'set-name',
        item: 'newItem',
      });
      // TEST
      expect(result).toEqual({
        resource: 'resource-name',
        setName: 'set-name',
        items: ['existItem', 'newItem'],
        added: true,
      });
    });

    it('Add usage to entry that does not exist before', async () => {
      // BUILD
      dbService.table.update.mockResolvedValueOnce({});
      // OPERATE
      const result = await service.addUsage(requestContext, {
        resource: 'resource-name',
        setName: 'set-name',
        item: 'newItem',
      });
      // TEST
      expect(result).toEqual({
        resource: 'resource-name',
        setName: 'set-name',
        items: ['newItem'],
        added: true,
      });
    });

    it('Should not add usage when it already exist', async () => {
      // BUILD
      dbService.table.update.mockResolvedValueOnce({ items: ['existItem'] });
      // OPERATE
      const result = await service.addUsage(requestContext, {
        resource: 'resource-name',
        setName: 'set-name',
        item: 'existItem',
      });
      // TEST
      expect(result).toEqual({
        resource: 'resource-name',
        setName: 'set-name',
        items: ['existItem'],
        added: false,
      });
    });
  });

  describe('removeUsage', () => {
    it('Remove existing usage', async () => {
      // BUILD
      dbService.table.delete.mockReturnThis();
      dbService.table.update.mockResolvedValueOnce({ items: ['existItem'] });
      // OPERATE
      const result = await service.removeUsage(requestContext, {
        resource: 'resource-name',
        setName: 'set-name',
        item: 'existItem',
      });
      // TEST
      expect(result).toEqual({
        resource: 'resource-name',
        setName: 'set-name',
        items: [],
        removed: true,
      });
    });

    it('Do nothing and return not removed if the usage does not exist', async () => {
      // BUILD
      dbService.table.delete.mockReturnThis();
      dbService.table.update.mockResolvedValueOnce({ items: ['anotherExistItem'] });
      // OPERATE
      const result = await service.removeUsage(requestContext, {
        resource: 'resource-name',
        setName: 'set-name',
        item: 'existItem',
      });
      // TEST
      expect(result).toEqual({
        resource: 'resource-name',
        setName: 'set-name',
        items: ['anotherExistItem'],
        removed: false,
      });
    });
  });

  describe('getResourceUsage', () => {
    it('Should return usage', async () => {
      // BUILD
      dbService.table.query.mockResolvedValueOnce([
        { pk: 'resource-name', sk: 'setName1', items: ['item1', 'item2'] },
        { pk: 'resource-name', sk: 'setName2', items: ['item3', 'item4'] },
      ]);
      // OPERATE
      const result = await service.getResourceUsage(requestContext, {
        resource: 'resource-name',
      });
      // TEST
      expect(result).toEqual({
        setName1: ['item1', 'item2'],
        setName2: ['item3', 'item4'],
      });
    });

    it('Should query specific set if set name is provided', async () => {
      // BUILD
      dbService.table.query.mockResolvedValueOnce([{ pk: 'resource-name', sk: 'setName1', items: ['item1', 'item2'] }]);
      // OPERATE
      const result = await service.getResourceUsage(requestContext, {
        resource: 'resource-name',
        setName: 'setName1',
      });
      // TEST
      expect(dbService.table.sortKey).toHaveBeenCalled();
      expect(result).toEqual({
        setName1: ['item1', 'item2'],
      });
    });
  });
});
