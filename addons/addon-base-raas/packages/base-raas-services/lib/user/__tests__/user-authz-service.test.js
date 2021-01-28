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
    it('should not allow non-admins to create users', async () => {
      // BUILD
      const notActiveNotAdmin = {};

      const activeNotAdmin = {
        principal: { status: 'active' },
      };

      // OPERATE
      const notActiveNotAdminTest = await service.authorizeCreateBulk(notActiveNotAdmin, { action: 'test' });
      const activeNotAdminTest = await service.authorizeCreateBulk(activeNotAdmin, { action: 'test' });

      // CHECK
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
    });

    it('should only allow active admins to create users', async () => {
      // BUILD
      const notActiveAdmin = {
        principal: { isAdmin: true },
      };
      const activeAdmin = {
        principal: {
          status: 'active',
          isAdmin: true,
        },
      };

      // OPERATE
      const notActiveAdminTest = await service.authorizeCreateBulk(notActiveAdmin, { action: 'test' });
      const activeAdminTest = await service.authorizeCreateBulk(activeAdmin, { action: 'test' });

      // CHECK
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
    it('should only allow active users in the request context to update', async () => {
      const testContext = {
        principalIdentifier: {
          uid: 'u-currentUserId',
        },
        principal: {
          status: 'active',
        },
      };

      const userInContext = {
        uid: 'u-currentUserId',
        status: 'completed',
      };

      const pendingUserInContext = {
        uid: 'u-pendingUserId',
        status: 'pending',
      };

      const userNoContext = {
        uid: 'u-someUserId',
        status: 'completed',
      };

      const testUserInContext = await service.authorizeUpdate(testContext, {}, userInContext);
      const testPendingInactiveUserInContext = await service.authorizeUpdate(testContext, {}, pendingUserInContext);
      const testUserNotInContext = await service.authorizeUpdate(testContext, {}, userNoContext);

      expect(testUserInContext).toMatchObject({ effect: 'allow' });
      expect(testPendingInactiveUserInContext).toMatchObject({ effect: 'deny' });
      expect(testUserNotInContext).toMatchObject({ effect: 'deny' });
    });

    it('should allow active admins to update', async () => {
      // BUILD
      const testContextAdmin = {
        principal: {
          status: 'active',
          isAdmin: true,
        },
      };
      const user = {
        uid: 'u-someUserId',
        status: 'completed',
      };

      // OPERATE
      const testAdminNotInContext = await service.authorizeUpdate(testContextAdmin, {}, user);

      // CHECK
      expect(testAdminNotInContext).toMatchObject({ effect: 'allow' });
    });
  });

  describe('authorizeUpdateAttributes test', () => {
    const unprotAttr = {
      lastName: 'string',
    };
    const userRole = {
      userRole: 'admin',
    };
    const existingUser = {
      isExternalUser: false,
      userRole: 'researcher',
      authenticationProviderId: 'Queequeg',
      isAdmin: false,
      projectId: 'Rokovoko',
      lastName: 'Kujira',
      userType: 'tree',
    };
    const existingRootUser = {
      userRole: 'admin',
      authenticationProviderId: 'Fedallah',
      projectId: 'Tashtego',
      lastName: 'Daggoo',
      userType: 'root',
    };
    const existingAdminUser = {
      userRole: 'admin',
      isAdmin: true,
      authenticationProviderId: 'Fedallah',
      projectId: ['Tashtego'],
      lastName: 'Daggoo',
    };

    it('should only allow users to change unprotected attributes of themselves', async () => {
      // BUILD
      const isExternalUser = {
        isExternalUser: true,
      };
      const isAdmin = {
        isAdmin: true,
      };
      const projectId = {
        projectId: ['testProjectId1', 'testProjectId2'],
      };
      const identityProviderName = {
        identityProviderName: 'some-identity-provider-name',
      };
      const authenticationProviderId = {
        authenticationProviderId: '123456',
      };
      const userType = {
        userType: 'root',
      };
      const isSamlAuthenticatedUser = {
        isSamlAuthenticatedUser: true,
      };

      // OPERATE
      const userUserUnprot = await service.authorizeUpdateAttributes({}, {}, unprotAttr, existingUser);
      const userRootUnprot = await service.authorizeUpdateAttributes({}, {}, unprotAttr, existingRootUser);
      const userUpdateRole = await service.authorizeUpdateAttributes({}, {}, userRole, existingUser);
      const userUpdateIsExternalUser = await service.authorizeUpdateAttributes({}, {}, isExternalUser, existingUser);
      const userUpdateIsAdmin = await service.authorizeUpdateAttributes({}, {}, isAdmin, existingUser);
      const userUpdateProjectId = await service.authorizeUpdateAttributes({}, {}, projectId, existingUser);
      const userUpdateIdpName = await service.authorizeUpdateAttributes({}, {}, identityProviderName, existingUser);
      const userUpdateIdpId = await service.authorizeUpdateAttributes({}, {}, authenticationProviderId, existingUser);
      const userUpdateType = await service.authorizeUpdateAttributes({}, {}, userType, existingUser);
      const userUpdateIsSamlAuthenticatedUser = await service.authorizeUpdateAttributes(
        {},
        {},
        isSamlAuthenticatedUser,
        existingUser,
      );
      const adminUpdateType = await service.authorizeUpdateAttributes(
        { principal: { isAdmin: true } },
        {},
        userType,
        existingAdminUser,
      );
      const adminUpdateIsAdmin = await service.authorizeUpdateAttributes(
        { principal: { isAdmin: true } },
        {},
        isAdmin,
        existingUser,
      );

      // CHECK
      expect(userUserUnprot).toMatchObject({ effect: 'allow' });
      expect(userRootUnprot).toMatchObject({ effect: 'deny' });
      expect(userUpdateRole).toMatchObject({ effect: 'deny' });
      expect(userUpdateIsExternalUser).toMatchObject({ effect: 'deny' });
      expect(userUpdateIsAdmin).toMatchObject({ effect: 'deny' });
      expect(userUpdateProjectId).toMatchObject({ effect: 'deny' });
      expect(userUpdateIdpName).toMatchObject({ effect: 'deny' });
      expect(userUpdateIdpId).toMatchObject({ effect: 'deny' });
      expect(userUpdateType).toMatchObject({ effect: 'deny' });
      expect(adminUpdateType).toMatchObject({ effect: 'deny' });
      expect(userUpdateIsSamlAuthenticatedUser).toMatchObject({ effect: 'deny' });
      expect(adminUpdateIsAdmin).toMatchObject({ effect: 'allow' });
    });

    it('should allow admins to change any attribute of other non-root users', async () => {
      // BUILD
      const adminContext = {
        principal: {
          status: 'active',
          isAdmin: true,
          userType: 'admin',
        },
      };

      // OPERATE
      const adminUserUnprot = await service.authorizeUpdateAttributes(adminContext, {}, unprotAttr, existingUser);
      const adminRootUnprot = await service.authorizeUpdateAttributes(adminContext, {}, unprotAttr, existingRootUser);
      const adminUserProt = await service.authorizeUpdateAttributes(adminContext, {}, userRole, existingUser);

      // CHECK
      expect(adminUserUnprot).toMatchObject({ effect: 'allow' });
      expect(adminRootUnprot).toMatchObject({ effect: 'deny' });
      expect(adminUserProt).toMatchObject({ effect: 'allow' });
    });

    it('should allow root to change anything except other root protected permissions', async () => {
      // BUILD
      const rootContext = {
        principal: {
          status: 'active',
          isAdmin: true,
          userType: 'root',
        },
      };

      // OPERATE
      const rootUserUnprot = await service.authorizeUpdateAttributes(rootContext, {}, unprotAttr, existingUser);
      const rootRootUnprot = await service.authorizeUpdateAttributes(rootContext, {}, unprotAttr, existingRootUser);
      const rootUserProt = await service.authorizeUpdateAttributes(rootContext, {}, userRole, existingUser);
      const rootRootProt = await service.authorizeUpdateAttributes(
        rootContext,
        {},
        { userRole: 'researcher' },
        existingRootUser,
      );

      // CHECK
      expect(rootUserUnprot).toMatchObject({ effect: 'allow' });
      expect(rootRootUnprot).toMatchObject({ effect: 'allow' });
      expect(rootUserProt).toMatchObject({ effect: 'allow' });
      expect(rootRootProt).toMatchObject({ effect: 'deny' });
    });
  });
});
