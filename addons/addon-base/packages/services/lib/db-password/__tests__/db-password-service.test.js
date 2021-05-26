const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const Boom = require('@aws-ee/base-services-container/lib/boom');

const DbServiceMock = require('@aws-ee/base-services/lib/db-service');
const SettingsServiceMock = require('@aws-ee/base-services/lib/settings/env-settings-service');
const DbPasswordService = require('../db-password-service');

// Mocked dependencies
jest.mock('@aws-ee/base-services/lib/db-service');
jest.mock('@aws-ee/base-services/lib/settings/env-settings-service');

describe('db-password-service', () => {
  let service = null;
  let dbService = null;
  let settingService = null;
  const settingMockFunction = jest.fn();
  beforeAll(async () => {
    const container = new ServicesContainer();
    container.register('dbService', new DbServiceMock());
    container.register('dbPasswordService', new DbPasswordService());
    container.register('settings', new SettingsServiceMock());

    await container.initServices();

    service = await container.find('dbPasswordService');
    dbService = await container.find('dbService');
    settingService = await container.find('settings');

    settingMockFunction.mockReturnValue('root');
    settingService.get = settingMockFunction;

    service.assertAuthorized = jest.fn();
  });

  const adminNonSystemRequestContext = {
    actions: [],
    resources: [],
    authenticated: true,
    principal: {
      uid: 'abcd',
      username: 'user1',
      ns: 'internal',
      isAdmin: true,
      userRole: 'admin',
      status: 'active',
    },
    attr: {},
    principalIdentifier: { uid: 'abcd' },
  };

  const systemRequestContext = {
    actions: [],
    resources: [],
    authenticated: true,
    principal: {
      uid: '_system_',
      username: '_system_',
      ns: 'internal',
      isAdmin: true,
      userRole: 'admin',
      status: 'active',
    },
    attr: {},
    principalIdentifier: { uid: '_system_' },
  };

  afterEach(() => {
    expect(settingMockFunction.mock.calls[0][0]).toBe('rootUserName');
  });

  describe('saveRootPassword', () => {
    it('should allow system to save root password', async () => {
      // OPERATE
      await service.saveRootPassword(systemRequestContext, { uid: 'abcd', password: 'fakePassword' });

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
    });

    it('should NOT allow non-system user to save root password', async () => {
      // OPERATE & CHECK
      await expect(
        service.saveRootPassword(adminNonSystemRequestContext, { uid: 'abcd', password: 'fakePassword' }),
      ).rejects.toEqual(new Boom().badRequest("'root' password can only be changed by 'system' user", true));
    });
  });

  describe('savePassword', () => {
    it('should allow admin to save password', async () => {
      // OPERATE
      await service.savePassword(adminNonSystemRequestContext, {
        username: 'John',
        uid: 'abcd',
        password: 'fakePassword',
      });

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
    });

    it('should NOT allow admin to save root password', async () => {
      // OPERATE & CHECK
      await expect(
        service.savePassword(adminNonSystemRequestContext, {
          username: 'root',
          uid: 'abcd',
          password: 'fakePassword',
        }),
      ).rejects.toEqual(new Boom().badRequest("'root' password can not be changed", true));
    });

    it('should NOT allow system to save root password', async () => {
      // OPERATE & CHECK
      await expect(
        service.savePassword(systemRequestContext, {
          username: 'root',
          uid: 'abcd',
          password: 'fakePassword',
        }),
      ).rejects.toEqual(new Boom().badRequest("'root' password can not be changed", true));
    });

    it('should NOT allow non current user to save password', async () => {
      const nonAdminRequestContext = {
        actions: [],
        resources: [],
        authenticated: true,
        principal: {
          uid: 'xyz',
          username: 'user2',
          ns: 'internal',
          isAdmin: false,
          userRole: 'admin',
          status: 'active',
        },
        attr: {},
        principalIdentifier: { uid: 'xyz' },
      };

      // OPERATE & CHECK
      await expect(
        service.savePassword(nonAdminRequestContext, {
          username: 'fakeUser',
          uid: 'abcd',
          password: 'fakePassword',
        }),
      ).rejects.toEqual(new Boom().forbidden('You are not authorized to perform this operation', true));
    });

    it('should allow current user to save password', async () => {
      const nonAdminRequestContext = {
        actions: [],
        resources: [],
        authenticated: true,
        principal: {
          uid: 'abcd',
          username: 'user2',
          ns: 'internal',
          isAdmin: false,
          userRole: 'admin',
          status: 'active',
        },
        attr: {},
        principalIdentifier: { uid: 'abcd' },
      };

      // OPERATE
      await service.savePassword(nonAdminRequestContext, {
        username: 'user2',
        uid: 'abcd',
        password: 'fakePassword',
      });

      // CHECK
      expect(dbService.table.update).toHaveBeenCalled();
    });
  });
});
