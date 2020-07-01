const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const UserAuthzService = require('../user-authz-service');

describe('UserAuthzService', () => {
  let service = null;
  beforeEach(async () => {
    // Initialize services container and register dependencies
    const container = new ServicesContainer();

    container.register('userAuthzService', new UserAuthzService());
    await container.initServices();

    // Get instance of the service we are testing
    service = await container.find('userAuthzService');
  });

  describe('authorize test', () => {
    it('should call the correct function specified', async () => {
      service.authorizeCreateBulk = jest.fn();
      service.authorizeUpdate = jest.fn();
      service.authorizeUpdateAttributes = jest.fn();

      const defParams = {
        // non-defined actions should return the input
        action: 'wrong action!',
        effect: 'allow',
        reason: 'just for fun!',
      };

      const denyCreate = {
        // this should return the input
        action: 'createBulk',
        effect: 'deny',
      };

      const denyUpdate = {
        // this should run successfully
        action: 'update',
        effect: 'deny',
      };
      await service.authorize({}, { action: 'createBulk' });
      await service.authorize({}, { action: 'update' });
      await service.authorize({}, { action: 'updateAttributes' });

      const defaultCase = await service.authorize({}, defParams);
      const denyCreateCase = await service.authorize({}, denyCreate);
      await service.authorize({}, denyUpdate);

      expect(defaultCase).toEqual(defParams);
      expect(denyCreateCase).toEqual(denyCreate);
      expect(service.authorizeCreateBulk).toHaveBeenCalledTimes(1);
      expect(service.authorizeUpdate).toHaveBeenCalledTimes(2);
      expect(service.authorizeUpdateAttributes).toHaveBeenCalled();
    });
  });

  describe('authorizeCreateBulk test', () => {
    it('should authorize cases according to permissions', async () => {
      // mock functions to allow all requests
      const notActiveNotAdmin = {};

      const activeNotAdmin = {
        principal: { status: 'active' },
      };

      const notActiveAdmin = {
        principal: { isAdmin: true },
      };
      const activeAdmin = {
        principal: {
          status: 'active',
          isAdmin: true,
        },
      };

      const notActiveNotAdminTest = await service.authorizeCreateBulk(notActiveNotAdmin, { action: 'test' });
      const activeNotAdminTest = await service.authorizeCreateBulk(activeNotAdmin, { action: 'test' });
      const notActiveAdminTest = await service.authorizeCreateBulk(notActiveAdmin, { action: 'test' });
      const activeAdminTest = await service.authorizeCreateBulk(activeAdmin, { action: 'test' });

      expect(notActiveNotAdminTest).toMatchObject({
        effect: 'deny',
        reason: {
          message: 'Cannot perform the specified action "test". The caller is not active.',
          safe: false,
        },
      });
      expect(activeNotAdminTest).toMatchObject({
        effect: 'deny',
        reason: {
          message: 'Cannot perform the specified action "test". Only admins can.',
          safe: false,
        },
      });
      expect(notActiveAdminTest).toMatchObject({
        effect: 'deny',
        reason: {
          message: 'Cannot perform the specified action "test". The caller is not active.',
          safe: false,
        },
      });
      expect(activeAdminTest).toMatchObject({
        effect: 'allow',
      });
    });
  });

  describe('authorizeUpdate test', () => {
    it('should only allow active admins or active users in the request context', async () => {
      const testContext = {
        principalIdentifier: {
          username: 'Arthur Anderson',
          ns: 'Sir Charms||||Magically Delicious',
        },
        principal: {
          status: 'active',
        },
      };

      const testContextAdmin = {
        principal: {
          status: 'active',
          isAdmin: true,
        },
      };

      const userInContext = {
        identityProviderName: 'Sir Charms',
        authenticationProviderId: 'Magically Delicious',
        username: 'Arthur Anderson',
        status: 'completed',
      };

      const pendingUserInContext = {
        identityProviderName: 'Cuckoo',
        authenticationProviderId: 'Cocoa Puffs',
        username: 'birdy',
        status: 'pending',
      };

      const userNoContext = {
        identityProviderName: 'Sir Charms',
        authenticationProviderId: 'Magically Delicious',
        username: 'Lucky',
        status: 'completed',
      };

      const testUserInContext = await service.authorizeUpdate(testContext, {}, userInContext);
      const testPendingInactiveUserInContext = await service.authorizeUpdate(testContext, {}, pendingUserInContext);
      const testUserNotInContext = await service.authorizeUpdate(testContext, {}, userNoContext);
      const testAdminNotInContext = await service.authorizeUpdate(testContextAdmin, {}, userInContext);

      expect(testUserInContext).toMatchObject({ effect: 'allow' });
      expect(testPendingInactiveUserInContext).toMatchObject({ effect: 'deny' });
      expect(testUserNotInContext).toMatchObject({ effect: 'deny' });
      expect(testAdminNotInContext).toMatchObject({ effect: 'allow' });
    });
  });

  describe('authorizeUpdateAttributes test', () => {
    it('should allow users to change attributes of users with same or lower permissions', async () => {

      const adminContext = {
        principal: {
          status: 'active',
          isAdmin: true,
          userType: 'admin',
        },
      };

      const rootContext = {
        principal: {
          status: 'active',
          isAdmin: true,
          userType: 'root',
        },
      };

      const existingUser = {
        isExternalUser: false,
        userRole: 'Suifu',
        authenticationProviderId: 'Queequeg',
        isAdmin: false,
        projectId: 'Rokovoko',
        randomAttrib: 'Kujira',
        userType: 'tree',
      };

      const existingRootUser = {
        userRole: 'Suifu',
        authenticationProviderId: 'Fedallah',
        projectId: 'Tashtego',
        randomAttrib: 'Daggoo',
        userType: 'root',
      };

      const unprotAttr = {
        randomAttrib: 'sakana',
      };

      const protAttr = {
        userRole: 'yari wo nagetsukeru',
      };

      const userUserUnprot = await service.authorizeUpdateAttributes({}, {}, unprotAttr, existingUser);
      const userRootUnprot = await service.authorizeUpdateAttributes({}, {}, unprotAttr, existingRootUser);
      const userUserProt = await service.authorizeUpdateAttributes({}, {}, protAttr, existingUser);
      const userRootProt = await service.authorizeUpdateAttributes({}, {}, protAttr, existingRootUser);

      const adminUserUnprot = await service.authorizeUpdateAttributes(adminContext, {}, unprotAttr, existingUser);
      const adminRootUnprot = await service.authorizeUpdateAttributes(adminContext, {}, unprotAttr, existingRootUser);
      const adminUserProt = await service.authorizeUpdateAttributes(adminContext, {}, protAttr, existingUser);
      const adminRootProt = await service.authorizeUpdateAttributes(adminContext, {}, protAttr, existingRootUser);

      const rootUserUnprot = await service.authorizeUpdateAttributes(rootContext, {}, unprotAttr, existingUser);
      const rootRootUnprot = await service.authorizeUpdateAttributes(rootContext, {}, unprotAttr, existingRootUser);
      const rootUserProt = await service.authorizeUpdateAttributes(rootContext, {}, protAttr, existingUser);
      const rootRootProt = await service.authorizeUpdateAttributes(rootContext, {}, protAttr, existingRootUser);

      expect(userUserUnprot).toMatchObject({ effect: 'allow' });
      expect(userRootUnprot).toMatchObject({ effect: 'deny' });
      expect(userUserProt).toMatchObject({ effect: 'deny' });
      expect(userRootProt).toMatchObject({ effect: 'deny' });

      expect(adminUserUnprot).toMatchObject({ effect: 'allow' });
      expect(adminRootUnprot).toMatchObject({ effect: 'deny' });
      expect(adminUserProt).toMatchObject({ effect: 'allow' });
      expect(adminRootProt).toMatchObject({ effect: 'deny' });

      expect(rootUserUnprot).toMatchObject({ effect: 'allow' });
      expect(rootRootUnprot).toMatchObject({ effect: 'allow' });
      expect(rootUserProt).toMatchObject({ effect: 'allow' });
      expect(rootRootProt).toMatchObject({ effect: 'deny' });
    });
  });
});
