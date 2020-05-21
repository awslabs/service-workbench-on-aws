const _ = require('lodash');
const { ensureCurrentUser } = require('@aws-ee/base-services/lib/authorization/assertions');
const { toUserNamespace } = require('@aws-ee/base-services/lib/user/helpers/user-namespace');
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
    const createUser = async curUser => {
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
        if (!_.isEmpty(userToCreate.email)) {
          const user = await this.findUser({
            username: userToCreate.username,
            authenticationProviderId: userToCreate.authenticationProviderId,
            identityProviderName: userToCreate.identityProviderName,
          });
          if (!user) {
            await this.createUser(requestContext, userToCreate);
          }
        }
      } catch (e) {
        const errorMsg = `Error creating user ${curUser.email}`;
        this.log.error(errorMsg);
        this.log.error(e);
        errors.push(errorMsg);
      }
    };
    // Create users in parallel in the specified batches
    const result = await processInBatches(users, batchSize, createUser);
    if (!_.isEmpty(errors)) {
      throw this.boom(`Errors creating users in bulk`, true).withPayload(errors);
    }

    // Write audit event
    await this.audit(requestContext, { action: 'create-users-batch', body: { totalUsers: _.size(users) } });

    return result;
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
      const userRolesService = await this.service('userRolesService');
      const userRole = await userRolesService.mustFind(requestContext, { id: userRoleId, fields: ['userType'] });
      if (_.toUpper(userRole.userType) !== 'INTERNAL') {
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
    const { username, authenticationProviderId, identityProviderName } = user;
    const ns = toUserNamespace(authenticationProviderId, identityProviderName);
    await ensureCurrentUser(requestContext, username, ns);

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
