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
const uuid = require('uuid');
const Service = require('@aws-ee/base-services-container/lib/service');
const { toUserNamespace } = require('@aws-ee/base-services/lib/user/helpers/user-namespace');
const { ensureCurrentUserOrAdmin, isCurrentUser } = require('@aws-ee/base-services/lib/authorization/assertions');

const authProviderConstants = require('../../constants').authenticationProviders;

const settingKeys = {
  tableName: 'dbUserApiKeys',
};
const maxActiveApiKeysPerUser = 5;

const redactIfNotForCurrentUser = (requestContext, apiKey, uid) => {
  if (!isCurrentUser(requestContext, { uid })) {
    // if the api key is issued for some other user then redact the api key material as user should be
    // only able to read his/her own api key value (even if the user is an admin)
    apiKey.key = undefined;
  }
  return apiKey;
};

class ApiKeyService extends Service {
  constructor() {
    super();
    this.dependency(['dbService', 'jwtService']);
    this.boom.extend(['invalidCredentials', 401]);
    this.boom.extend(['maxApiKeysLimitReached', 400]);
  }

  async init() {
    await super.init();
    const createInternals = async () => {
      const [dbService] = await this.service(['dbService']);
      const table = this.settings.get(settingKeys.tableName);
      const dbGetter = () => dbService.helper.getter().table(table);
      const dbUpdater = () => dbService.helper.updater().table(table);
      const dbQuery = () => dbService.helper.query().table(table);
      const ensureMaxApiKeysLimitNotReached = async (requestContext, { uid }) => {
        const existingApiKeys = await this.getApiKeys(requestContext, { uid });
        const existingActiveApiKeys = _.filter(existingApiKeys, apiKey => {
          const isActive = apiKey.status === 'active';
          const isExpired = apiKey.expiryTime && _.now() > apiKey.expiryTime;
          return isActive && !isExpired;
        });
        if (existingActiveApiKeys.length >= maxActiveApiKeysPerUser) {
          throw this.boom.maxApiKeysLimitReached(
            `Cannot create API Key. Maximum ${maxActiveApiKeysPerUser} active API keys per user is allowed.`,
            true,
          );
        }
      };
      return {
        dbGetter,
        dbUpdater,
        dbQuery,
        ensureMaxApiKeysLimitNotReached,
      };
    };
    this.internals = await createInternals();
  }

  async createApiKeyMaterial(requestContext, { apiKeyId, uid, expiryTime }) {
    if (!uid) {
      throw this.boom.badRequest("Cannot issue API Key. Missing uid. Don't know who to issue the API key for.", true);
    }
    if (expiryTime && !_.isNumber(expiryTime)) {
      // Make sure if "expiryTime" is specified then it is a valid "NumericDate" i.e., epoch time as number
      throw this.boom.badRequest(
        'Cannot issue API Key. Invalid expiryTime specified. expiryTime is optional. ' +
          'If it is specified then it must be a number indicating epoch time',
        true,
      );
    }

    const authenticationProviderId = _.get(requestContext, 'principal.authenticationProviderId');
    const identityProviderName = _.get(requestContext, 'principal.identityProviderName');
    const ns = toUserNamespace(authenticationProviderId, identityProviderName);

    // The JWT service sets "expiresIn" by default based on the settings.
    // Make sure JWT service does not set it here as we are controlling that via the "exp" claim directly
    const apiKeyJwtToken = {
      'sub': uid,
      'iss': authProviderConstants.internalAuthProviderId, // This is validated by internal auth provider so set issuer as internal
      // Add private claims under "custom:". These claims are then used at the time of verifying token
      'custom:tokenType': 'api',
      'custom:apiKeyId': apiKeyId,
      'custom:userNs': ns,
      'custom:authenticationProviderId': authenticationProviderId,
      'custom:identityProviderName': identityProviderName,
    };
    // If expiryTime is specified then set it
    if (expiryTime) {
      // If code reached here then it means valid expiryTime is specified
      apiKeyJwtToken.exp = expiryTime;
    }

    const jwtService = await this.service('jwtService');
    return jwtService.sign(apiKeyJwtToken, { expiresIn: undefined });
  }

  async revokeApiKey(requestContext, { uid, keyId }) {
    // ensure the caller is asking to revoke api key for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, { uid });

    // ensure that the key exists and set it's status to "reovked", if it does
    const apiKey = await this.internals
      .dbGetter()
      .key({ id: keyId })
      .get();
    if (!apiKey) {
      throw this.boom.badRequest('Cannot revoke API Key. The API key does not exist.', true);
    }
    apiKey.status = 'revoked';

    // Update the key with "revoked" status
    const revokedApiKey = await this.internals
      .dbUpdater()
      .key({ id: apiKey.id })
      .item(apiKey)
      .update();

    return redactIfNotForCurrentUser(requestContext, revokedApiKey, uid);
  }

  async issueApiKey(requestContext, { uid, expiryTime }) {
    // ensure the caller is asking to issue new api key for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, { uid });

    // ensure max active api keys limit is not reached before issuing new key
    await this.internals.ensureMaxApiKeysLimitNotReached(requestContext, { uid });

    // create new api key object
    const apiKeyId = uuid.v4();
    const apiKeyMaterial = await this.createApiKeyMaterial(requestContext, {
      apiKeyId,
      uid,
      expiryTime,
    });
    // TODO: Add TTL based on revocation status and expiry time
    const newApiKey = {
      uid,
      id: apiKeyId,
      key: apiKeyMaterial,
      status: 'active',
    };
    if (expiryTime) {
      newApiKey.expiryTime = expiryTime;
    }

    // save api key to db
    const apiKey = await this.internals
      .dbUpdater()
      .key({ id: newApiKey.id })
      .item(newApiKey)
      .update();

    // sanitize
    return redactIfNotForCurrentUser(requestContext, apiKey, uid);
  }

  /**
   * Api Key feature is DEPRECATED
   * All existing Api Keys should be denined
   * @param signedApiKey
   */
  async validateApiKey(signedApiKey) {
    if (_.isEmpty(signedApiKey)) {
      throw this.boom.forbidden('no api key was provided', true);
    }
    throw this.boom.invalidToken(
      'Existing internally generated API keys cannot be used for access. Contact your system admin about it.',
      true,
    );
  }

  async getApiKeys(requestContext, { uid }) {
    // ensure the caller is asking retrieve api keys for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, { uid });
    const apiKeys = await this.internals
      .dbQuery()
      .index('ByUID')
      .key('uid', uid)
      .query();

    return _.map(apiKeys, apiKey => redactIfNotForCurrentUser(requestContext, apiKey, uid));
  }

  async getApiKey(requestContext, { uid, keyId }) {
    // ensure the caller is asking to retrieve api key for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, { uid });

    const apiKey = await this.internals
      .dbGetter()
      .key({ id: keyId })
      .get();

    return redactIfNotForCurrentUser(requestContext, apiKey, uid);
  }

  async isApiKeyToken(decodedToken) {
    const tokenType = _.get(decodedToken, 'custom:tokenType');
    const apiKeyId = _.get(decodedToken, 'custom:apiKeyId');
    return tokenType === 'api' && !!apiKeyId;
  }
}

module.exports = ApiKeyService;
