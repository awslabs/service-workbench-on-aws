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
const { ensureCurrentUserOrAdmin, isCurrentUser } = require('@aws-ee/base-services/lib/authorization/assertions');

const authProviderConstants = require('../../constants').authenticationProviders;

const settingKeys = {
  tableName: 'dbTableUserApiKeys',
};
const maxActiveApiKeysPerUser = 5;

const redactIfNotForCurrentUser = (requestContext, apiKey, username, ns) => {
  if (!isCurrentUser(requestContext, username, ns)) {
    // if the api key is issued for some other user then redact the api key material as user should be
    // only able to read his/her own api key value (even if the user is an admin)
    apiKey.key = undefined;
  }
  return apiKey;
};
const encode = (username, ns) => `${ns}/${username}`;

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
      const ensureMaxApiKeysLimitNotReached = async (requestContext, { username, ns }) => {
        const existingApiKeys = await this.getApiKeys(requestContext, {
          username,
          ns,
        });
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

  async createApiKeyMaterial(requestContext, { apiKeyId, username, ns, expiryTime }) {
    if (!username) {
      throw this.boom.badRequest(
        "Cannot issue API Key. Missing username. Don't know who to issue the API key for.",
        true,
      );
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

    // The JWT service sets "expiresIn" by default based on the settings.
    // Make sure JWT service does not set it here as we are controlling that via the "exp" claim directly
    const apiKeyJwtToken = {
      'sub': username,
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

  async revokeApiKey(requestContext, { username, ns, keyId }) {
    // ensure the caller is asking to revoke api key for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, username, ns);

    // ensure that the key exists and set it's status to "reovked", if it does
    const unameWithNs = encode(username, ns);
    const apiKey = await this.internals
      .dbGetter()
      .key({ unameWithNs, id: keyId })
      .get();
    if (!apiKey) {
      throw this.boom.badRequest('Cannot revoke API Key. The API key does not exist.', true);
    }
    apiKey.status = 'revoked';

    // Update the key with "revoked" status
    const revokedApiKey = await this.internals
      .dbUpdater()
      .key({ unameWithNs, id: apiKey.id })
      .item(apiKey)
      .update();

    return redactIfNotForCurrentUser(requestContext, revokedApiKey, username, ns);
  }

  async issueApiKey(requestContext, { username, ns, expiryTime }) {
    // ensure the caller is asking to issue new api key for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, username, ns);

    // ensure max active api keys limit is not reached before issuing new key
    await this.internals.ensureMaxApiKeysLimitNotReached(requestContext, {
      username,
      ns,
    });

    // create new api key object
    const apiKeyId = uuid.v4();
    const apiKeyMaterial = await this.createApiKeyMaterial(requestContext, {
      apiKeyId,
      username,
      ns,
      expiryTime,
    });
    const unameWithNs = encode(username, ns);
    // TODO: Add TTL based on revocation status and expiry time
    const newApiKey = {
      unameWithNs,
      username,
      ns,
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
      .key({ unameWithNs, id: newApiKey.id })
      .item(newApiKey)
      .update();

    // sanitize
    return redactIfNotForCurrentUser(requestContext, apiKey, username, ns);
  }

  async validateApiKey(signedApiKey) {
    // Make sure the key is specified
    if (_.isEmpty(signedApiKey)) {
      throw this.boom.forbidden('no api key was provided', true);
    }

    // Make sure the key is a valid non-expired JWT token and has correct signature
    const jwtService = await this.service('jwtService');
    const verifiedApiKeyJwtToken = await jwtService.verify(signedApiKey);
    const { 'sub': username, 'custom:userNs': ns } = verifiedApiKeyJwtToken;
    if (_.isEmpty(username)) {
      throw this.boom.invalidToken('No "sub" is provided in the api key', true);
    }

    // Make sure the key is an API key (and not the regular JWT token)
    if (!this.isApiKeyToken(verifiedApiKeyJwtToken)) {
      throw this.boom.invalidToken('The given key is not valid for API access', true);
    }

    // Make sure the key is an active key (by checking it against the DB)
    const apiKeyId = _.get(verifiedApiKeyJwtToken, 'custom:apiKeyId');
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    const unameWithNs = encode(username, ns);
    const apiKey = await dbService.helper
      .getter()
      .table(table)
      .key({ unameWithNs, id: apiKeyId })
      .get();

    if (!apiKey) {
      throw this.boom.invalidToken('The given key is not valid for API access', true);
    }
    if (apiKey.status !== 'active') {
      throw this.boom.invalidToken('The given API key is not active', true);
    }
    // If code reached here then this is a valid key
    return { verifiedToken: verifiedApiKeyJwtToken, username, ns };
  }

  async getApiKeys(requestContext, { username, ns }) {
    // ensure the caller is asking retrieve api keys for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, username, ns);
    const unameWithNs = encode(username, ns);
    const apiKeys = await this.internals
      .dbQuery()
      .key('unameWithNs', unameWithNs)
      .query();

    return _.map(apiKeys, apiKey => redactIfNotForCurrentUser(requestContext, apiKey, username, ns));
  }

  async getApiKey(requestContext, { username, ns, keyId }) {
    // ensure the caller is asking to retrieve api key for him/herself or is admin
    await ensureCurrentUserOrAdmin(requestContext, username, ns);

    const unameWithNs = encode(username, ns);
    const apiKey = await this.internals
      .dbGetter()
      .key({ unameWithNs, id: keyId })
      .get();

    return redactIfNotForCurrentUser(requestContext, apiKey, username, ns);
  }

  async isApiKeyToken(decodedToken) {
    const tokenType = _.get(decodedToken, 'custom:tokenType');
    const apiKeyId = _.get(decodedToken, 'custom:apiKeyId');
    return tokenType === 'api' && !!apiKeyId;
  }
}

module.exports = ApiKeyService;
