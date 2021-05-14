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
const { ensureCurrentUser } = require('@aws-ee/base-services/lib/authorization/assertions');
const BaseUserService = require('@aws-ee/base-services/lib/user/user-service');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

const createUserJsonSchema = require('../schema/create-user');
const updateUserJsonSchema = require('../schema/update-user');

class UserService extends BaseUserService {
  constructor() {
    super();
    this.dependency(['userRolesService']);
  }

  /**
   * Method to create users in bulk in the specified number of batches. The method will try to create users in parallel
   * within a given batch but will not start new batch until a previous batch is complete.
   *
   * @param requestContext
   * @param users
   * @param defaultAuthNProviderId
   * @param batchSize
   * @returns {Promise<Array>}
   */
  async createUsers(requestContext, users, defaultAuthNProviderId, batchSize = 5) {
    // ensure that the caller has permissions to create user
    await this.assertAuthorized(requestContext, { action: 'createBulk' });

    const errors = [];
    const validationErrors = [];
    const usersToCreate = [];
    let successCount = 0;
    let errorCount = 0;

    const validateUser = async curUser => {
      try {
        const isAdmin = curUser.isAdmin === true;
        const authenticationProviderId =
          curUser.authenticationProviderId ||
          defaultAuthNProviderId ||
          requestContext.principal.authenticationProviderId;
        const name = await this.toDefaultName(curUser.email);
        const userType = await this.toUserType(requestContext, curUser.userRole);
        const userToCreate = {
          firstName: _.isEmpty(curUser.firstName) ? name : curUser.firstName,
          lastName: _.isEmpty(curUser.lastName) ? name : curUser.lastName,
          username: curUser.email,
          email: curUser.email,
          isAdmin,
          userRole: curUser.userRole,
          authenticationProviderId,
          identityProviderName: curUser.identityProviderName,
          status: 'active',
          isExternalUser: userType === 'EXTERNAL',
        };

        // Check if user already exists
        if (!_.isEmpty(curUser.email)) {
          const user = await this.findUserByPrincipal({
            username: userToCreate.username,
            authenticationProviderId: userToCreate.authenticationProviderId,
            identityProviderName: userToCreate.identityProviderName,
          });
          if (user) {
            throw this.boom.alreadyExists('Cannot add user. The user already exists.', true);
          }
        }

        // Validate user data
        await this.validateCreateUser(requestContext, userToCreate);

        usersToCreate.push(userToCreate);
      } catch (e) {
        const errorMsg = e.safe // if error is boom error then see if it is safe to propagate its message
          ? `Error creating user ${curUser.email}. ${e.message}`
          : `Error creating user ${curUser.email}`;

        this.log.error(errorMsg);
        this.log.error(e);
        validationErrors.push(errorMsg);
      }
    };

    const createUser = async curUser => {
      try {
        await this.createUser(requestContext, curUser);
        successCount += 1;
      } catch (e) {
        const errorMsg = e.safe // if error is boom error then see if it is safe to propagate its message
          ? `Error creating user ${curUser.email}. ${e.message}`
          : `Error creating user ${curUser.email}`;

        this.log.error(errorMsg);
        this.log.error(e);
        errors.push(errorMsg);

        errorCount += 1;
      }
    };
    // Check to make sure users to create don't already exist (if so, exit early with badRequest)
    await processInBatches(users, batchSize, validateUser);
    if (!_.isEmpty(validationErrors)) {
      throw this.boom
        .badRequest(`Error: Some entries have validation errors. No users were added.`, true)
        .withPayload(validationErrors);
    }

    // Create users in parallel in the specified batches
    await processInBatches(usersToCreate, batchSize, createUser);
    if (!_.isEmpty(errors)) {
      // Write audit event before throwing error since some users were still added
      await this.audit(requestContext, {
        action: 'create-users-batch',
        body: {
          totalUsers: _.size(users),
          completedSuccessfully: false,
          numErrors: errorCount,
          numSuccesses: successCount,
        },
      });
      throw this.boom
        .internalError(`Errors creating users in bulk. Check the payload for more details.`, true)
        .withPayload(errors);
    } else {
      // Write audit event
      await this.audit(requestContext, {
        action: 'create-users-batch',
        body: { totalUsers: _.size(users), completedSuccessfully: true },
      });
    }
    return { successCount, errorCount };
  }

  async updateUser(requestContext, user) {
    if (user.userRole) {
      const userType = await this.toUserType(requestContext, user.userRole);

      user.isExternalUser = userType === 'EXTERNAL';
    }

    return super.updateUser(requestContext, user);
  }

  async listUsers(requestContext, { fields = [] } = {}) {
    const users = await super.listUsers(requestContext, fields);

    const isAdmin = _.get(requestContext, 'principal.isAdmin', false);

    const fieldsToOmit = isAdmin ? ['encryptedCreds'] : ['encryptedCreds', 'userRole'];
    const sanitizedUsers = users.map(user => _.omit(user, fieldsToOmit));
    return sanitizedUsers;
  }

  async getCreateUserJsonSchema() {
    return createUserJsonSchema;
  }

  async getUpdateUserJsonSchema() {
    return updateUserJsonSchema;
  }

  async assertValidProjectId(requestContext, input, existingUser = {}) {
    // in case of updateUser, there may be an existingUser with existing projectId, in that case, the input must
    // specify a valid internal userRole or also make projectId empty array
    const user = { ...existingUser, ...input };
    // if projectId is not specified or if it's empty array then nothing to validate just return
    if (!user.projectId || _.isEmpty(user.projectId)) {
      return;
    }

    // Only internal users (i.e., user with userRole.userType === INTERNAL) can be assigned projects,
    const userRoleId = input.userRole;
    if (userRoleId) {
      if (_.toLower(userRoleId) === 'internal-guest') {
        throw this.boom.forbidden('Guest users cannot be assigned a project', true);
      }

      const userRolesService = await this.service('userRolesService');
      const userRole = await userRolesService.mustFind(requestContext, { id: userRoleId, fields: ['userType'] });
      if (_.toLower(userRole.userType) !== 'internal') {
        throw this.boom.forbidden('External users cannot be assigned a project', true);
      }
    }
  }

  async validateCreateUser(requestContext, input) {
    await super.validateCreateUser(requestContext, input);

    // Make sure that the projectId(s) are not specified for user with any external role
    await this.assertValidProjectId(requestContext, input);
  }

  async setDefaultAttributes(requestContext, user) {
    const setDefaultIf = checkFn => {
      return (attribName, defaultValue) => {
        if (checkFn(user[attribName])) {
          user[attribName] = defaultValue;
        }
      };
    };
    const setDefaultIfNil = setDefaultIf(_.isNil);
    const setDefaultIfEmpty = setDefaultIf(_.isEmpty);

    // Set default values for "status", and "userRole" if they are not specified in the user
    if (user.userType === 'root') {
      // default userRole to 'admin' if it's root user
      setDefaultIfNil('userRole', 'admin');
    } else {
      // for all other users (non-root users) set "status" to "inactive" by default
      setDefaultIfNil('status', 'inactive');

      // for all other users (non-root users) set "userRole" to "guest" by default
      setDefaultIfNil('userRole', 'guest');
    }
    const { email, userRole } = user;
    const name = await this.toDefaultName(email);
    const userType = await this.toUserType(requestContext, userRole);

    setDefaultIfEmpty('username', email);
    setDefaultIfEmpty('firstName', name);
    setDefaultIfEmpty('lastName', name);
    setDefaultIfEmpty('encryptedCreds', 'N/A');
    setDefaultIfEmpty('applyReason', 'N/A');
    setDefaultIfEmpty('projectId', []);

    user.isAdmin = userRole === 'admin';
    user.isExternalUser = userType === 'EXTERNAL';

    // Give super class a chance to set it's defaults after we are done setting default values
    await super.setDefaultAttributes(requestContext, user);
  }

  async validateUpdateAttributes(requestContext, user, existingUser) {
    // call base impl first
    await super.validateUpdateAttributes(requestContext, user, existingUser);

    await this.assertValidProjectId(requestContext, user, existingUser);
  }

  async selfServiceUpdateUser(requestContext, user = {}) {
    // user can only update his/her own info via self-service update
    const { uid } = user;
    await ensureCurrentUser(requestContext, { uid });

    return this.updateUser(requestContext, user);
  }

  // Private methods
  async toUserType(requestContext, userRoleId) {
    const userRolesService = await this.service('userRolesService');
    let userType;
    if (userRoleId) {
      const { userType: userTypeInRole } = await userRolesService.mustFind(requestContext, { id: userRoleId });
      userType = userTypeInRole;
    }
    return userType;
  }

  async toDefaultName(userEmail) {
    return userEmail ? userEmail.substring(0, userEmail.lastIndexOf('@')) : '';
  }
}

module.exports = UserService;
