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

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

const { runAndCatch, generateId } = require('../helpers/utils');
const { toUserNamespace } = require('./helpers/user-namespace');
const createUserJsonSchema = require('../schema/create-user');
const updateUserJsonSchema = require('../schema/update-user');

const settingKeys = {
  tableName: 'dbUsers',
};

class UserService extends Service {
  constructor() {
    super();
    this.dependency([
      'dbService',
      'dbPasswordService',
      'authorizationService',
      'userAuthzService',
      'auditWriterService',
      'jsonSchemaValidationService',
    ]);
  }

  async init() {
    await super.init();
    const [userAuthzService] = await this.service(['userAuthzService']);

    // A private authorization condition function that just delegates to the userAuthzService
    this.allowAuthorized = (requestContext, { resource, action, effect, reason }, ...args) =>
      userAuthzService.authorize(requestContext, { resource, action, effect, reason }, ...args);
  }

  async createUser(requestContext, user) {
    // ensure that the caller has permissions to create the user
    // The following will result in checking permissions by calling the condition function "this.allowAuthorized" first
    await this.assertAuthorized(requestContext, { action: 'create', conditions: [this.allowAuthorized] }, user);

    // Validate input
    // The regex check for email must be the same as the one applied for native pool presignup lambda
    await this.validateCreateUser(requestContext, user);

    const { username, password } = user;
    delete user.password;

    // ensure that an internal user is not created in this request
    if (_.isUndefined(user.authenticationProviderId) || user.authenticationProviderId === 'internal') {
      throw this.boom.badRequest(
        'Internal users cannot be created. Please use an external IdP or the native Cognito user pool',
        true,
      );
    }

    const authenticationProviderId = user.authenticationProviderId;
    if (password && authenticationProviderId !== 'internal') {
      // If password is specified then make sure this is for adding user to internal authentication provider only
      // Password cannot be specified for any other auth providers
      throw this.boom.badRequest('Cannot specify password when adding federated users', true);
    }

    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    const by = _.get(requestContext, 'principalIdentifier.uid');

    const { identityProviderName } = user;
    const ns = toUserNamespace(authenticationProviderId, identityProviderName);

    // Set default attributes (such as "isAdmin" flag and "status") on the user being created
    await this.setDefaultAttributes(requestContext, user);

    const existingUser = await this.getUserByPrincipal({ username, ns });
    let result;
    const uid = await generateId('u-');
    if (existingUser) {
      throw this.boom.alreadyExists('Cannot add user. The user already exists.', true);
    } else {
      // user does not exist so create it
      result = await dbService.helper
        .updater()
        .table(table)
        .condition('attribute_not_exists(uid)')
        .key({ uid })
        .item(
          _.omit(
            {
              ...user,
              ns,
              authenticationProviderId,
              rev: 0,
              createdBy: by,
            },
            ['password'],
          ),
        )
        .update();
    }

    if (password) {
      // Save password salted hash for the user in internal auth provider (i.e., in passwords table)
      const dbPasswordService = await this.service('dbPasswordService');
      await dbPasswordService.savePassword(requestContext, { uid, username, password });
    }

    // Write audit event
    await this.audit(requestContext, { action: 'create-user', body: result });
    return result;
  }

  async updateUser(requestContext, user) {
    // ensure that the caller has permissions to update the user
    // The following will result in checking permissions by calling the condition function "this.allowAuthorized" first
    await this.assertAuthorized(requestContext, { action: 'update', conditions: [this.allowAuthorized] }, user);

    // Validate input
    await this.validateUpdateUser(requestContext, user);

    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    const by = _.get(requestContext, 'principalIdentifier.uid');

    const { uid } = user;
    const existingUser = await this.findUser({ uid });

    let result;
    if (existingUser) {
      // ensure that an internal user is not getting activated in this request
      if (existingUser.ns === 'internal' && user.status === 'active')
        throw this.boom.badRequest('Internal users cannot be activated', true);

      // ensure that the caller has permissions to update the user
      // The following will result in checking permissions by calling the condition function "this.allowAuthorized" first
      await this.assertAuthorized(
        requestContext,
        { action: 'updateAttributes', conditions: [this.allowAuthorized] },
        user,
        existingUser,
      );

      // Validate the user attributes being updated
      await this.validateUpdateAttributes(requestContext, user, existingUser);

      // user exists, so update it
      result = await runAndCatch(
        async () => {
          return dbService.helper
            .updater()
            .table(table)
            .key({ uid })
            .item(_.omit({ ...existingUser, ...user, updatedBy: by }, ['rev'])) // Remove 'rev' from the item. The "rev" method call below adds it correctly in update expression
            .rev(user.rev)
            .update();
        },
        async () => {
          throw this.boom.outdatedUpdateAttempt(
            `User "${uid}" was just updated before your request could be processed, please refresh and try again`,
            true,
          );
        },
      );

      // Write audit event
      await this.audit(requestContext, { action: 'update-user', body: result });
    } else {
      throw this.boom.notFound(`Cannot update user "${uid}". The user does not exist`, true);
    }
    return result;
  }

  async deleteUser(requestContext, { uid }) {
    const existingUser = await this.mustFindUser({ uid });

    // ensure that the caller has permissions to delete the user
    // The following will result in checking permissions by calling the condition function "this.allowAuthorized" first
    await this.assertAuthorized(requestContext, { action: 'delete', conditions: [this.allowAuthorized] }, existingUser);

    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    await runAndCatch(
      async () => {
        return dbService.helper
          .deleter()
          .table(table)
          .condition('attribute_exists(uid)')
          .key({ uid })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`The user "${uid}" does not exist`, true);
      },
    );

    // If user is authenticated by internal authn provider then also make sure to remove user's password
    // The passwords are stored as salted hash only for users with internal authn provider
    if (existingUser.authenticationProviderId === 'internal') {
      // Save password salted hash for the user in internal auth provider (i.e., in passwords table)
      const dbPasswordService = await this.service('dbPasswordService');
      await dbPasswordService.deletePassword(requestContext, { username: existingUser.username, uid });
    }

    // Write audit event
    await this.audit(requestContext, {
      action: 'delete-user',
      body: { uid, username: existingUser.username, ns: existingUser.ns },
    });

    return existingUser;
  }

  async ensureActiveUsers(users) {
    if (!Array.isArray(users)) {
      throw this.boom.badRequest(`invalid users type`, true);
    }

    if (_.isEmpty(users)) {
      return;
    }

    // ensure there are no duplicates
    const distinctUsers = new Set(users.map(u => u.uid));
    if (distinctUsers.size < users.length) {
      throw this.boom.badRequest('user list contains duplicates', true);
    }

    const findUserPromises = users.map(user => {
      const { uid } = user;
      return this.findUser({ uid });
    });

    const findUserResults = await Promise.all(findUserPromises);
    const findUserExistsStatus = findUserResults.map((user, index) => {
      return { usersIndex: index, exists: !!user };
    });
    const nonExistingUsers = findUserExistsStatus
      .filter(item => !item.exists)
      .map(item => users[item.usersIndex].username);

    if (nonExistingUsers.length) {
      throw this.boom.badRequest(`non available user: [${nonExistingUsers}]`, true);
    }
  }

  async findUser({ uid, fields = [] }) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    return dbService.helper
      .getter()
      .table(table)
      .key({ uid })
      .projection(fields)
      .get();
  }

  async mustFindUser({ uid, fields = [] }) {
    const user = await this.findUser({ uid, fields });
    if (!user) throw this.boom.notFound(`The user id "${uid}" is not found`, true);
    return user;
  }

  async getUserByPrincipal({ username, ns, fields = [] }) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    const users = await dbService.helper
      .query()
      .table(table)
      .index('Principal')
      .key('username', username)
      .sortKey('ns')
      .eq(ns)
      .projection(fields)
      .limit(1)
      .query();
    return users.length !== 0 ? users[0] : undefined;
  }

  async findUserByPrincipal({ username, authenticationProviderId, identityProviderName, fields = [] }) {
    const ns = toUserNamespace(authenticationProviderId, identityProviderName);
    return this.getUserByPrincipal({ username, ns, fields });
  }

  async mustFindUserByPrincipal({ username, authenticationProviderId, identityProviderName, fields = [] }) {
    const user = await this.findUserByPrincipal({
      username,
      authenticationProviderId,
      identityProviderName,
      fields,
    });
    if (!user) throw this.boom.notFound(`The user "${username}" is not found`, true);
    return user;
  }

  async existsByPrincipal({ username, authenticationProviderId, identityProviderName }) {
    const result = await this.findUserByPrincipal({
      username,
      authenticationProviderId,
      identityProviderName,
      fields: ['uid'],
    });
    return !!result;
  }

  async exists({ uid }) {
    const result = await this.findUser({ uid, fields: ['uid'] });
    return !!result;
  }

  async isCurrentUserActive(requestContext) {
    return this.isUserActive(requestContext.principal);
  }

  async isUserActive(user) {
    return user.status && user.status.toLowerCase() === 'active';
  }

  async listUsers(requestContext, { fields = [] } = {}) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    // TODO: Handle pagination
    const users = await dbService.helper
      .scanner()
      .table(table)
      .limit(1000)
      .projection(fields)
      .scan();

    const isAdmin = _.get(requestContext, 'principal.isAdmin', false);
    return isAdmin ? users : users.map(user => _.omit(user, ['isAdmin']));
  }

  // Protected methods
  /**
   * Method to set default attributes to the given user object.
   * For example, if the user does not have "isAdmin" flag set, the method defaults it to "false" (i.e., create non-admin user, by default)
   *
   * @param requestContext
   * @param user
   * @returns {Promise<void>}
   */
  async setDefaultAttributes(requestContext, user) {
    const setDefaultIfNil = (attribName, defaultValue) => {
      if (_.isNil(user[attribName])) {
        user[attribName] = defaultValue;
      }
    };
    setDefaultIfNil('isAdmin', false);
    setDefaultIfNil('status', 'active');
  }

  /**
   * Validates the input for createUser api. The base version just does JSON schema validation using the schema
   * returned by the "getCreateUserJsonSchema" method. Subclasses, can override this method to perform any additional
   * validations.
   *
   * @param requestContext
   * @param input
   * @returns {Promise<void>}
   */
  async validateCreateUser(requestContext, input) {
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    const schema = await this.getCreateUserJsonSchema();
    await jsonSchemaValidationService.ensureValid(input, schema);
  }

  /**
   * Validates the input for updateUser api. The base version just does JSON schema validation using the schema
   * returned by the "getUpdateUserJsonSchema" method. Subclasses, can override this method to perform any additional
   * validations.
   *
   * @param requestContext
   * @param input
   * @returns {Promise<void>}
   */
  async validateUpdateUser(requestContext, input) {
    const jsonSchemaValidationService = await this.service('jsonSchemaValidationService');
    const schema = await this.getUpdateUserJsonSchema();
    await jsonSchemaValidationService.ensureValid(input, schema);
  }

  // eslint-disable-next-line no-unused-vars
  async validateUpdateAttributes(requestContext, user, existingUser) {
    // No-op at base level
  }

  async getCreateUserJsonSchema() {
    return createUserJsonSchema;
  }

  async getUpdateUserJsonSchema() {
    return updateUserJsonSchema;
  }

  async assertAuthorized(requestContext, { action, conditions }, ...args) {
    const authorizationService = await this.service('authorizationService');

    // The "authorizationService.assertAuthorized" below will evaluate permissions by calling the "conditions" functions first
    // It will then give a chance to all registered plugins (if any) to perform their authorization.
    // The plugins can even override the authorization decision returned by the conditions
    // See "authorizationService.authorize" method for more details
    await authorizationService.assertAuthorized(
      requestContext,
      { extensionPoint: 'user-authz', action, conditions },
      ...args,
    );
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  async isInternalAuthUser(uid) {
    const user = await this.mustFindUser({ uid });
    return _.get(user, 'authenticationProviderId') === 'internal';
  }
}

module.exports = UserService;
