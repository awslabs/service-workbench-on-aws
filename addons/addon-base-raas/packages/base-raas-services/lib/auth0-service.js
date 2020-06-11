/*jshint esversion: 9 */

const Service = require('@aws-ee/base-services-container/lib/service');
const _ = require('lodash');
var request = require('request');
const {
  getSystemRequestContext
} = require('@aws-ee/base-services/lib/helpers/system-context');

const settingKeys = {
  paramStoreAuth0Domain: 'paramStoreAuth0Domain',
  paramStoreAuth0ClientId: 'paramStoreAuth0ClientId',
  paramStoreAuth0ClientSecret: 'paramStoreAuth0ClientSecret',
};

class Auth0Service extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'userService']);
  }

  async init() {
    await super.init();
    const domainKeyName = this.settings.get(settingKeys.paramStoreAuth0Domain);
    this.auth0Domain = await this.getSecret(domainKeyName);
    const clientIdKeyName = this.settings.get(settingKeys.paramStoreAuth0ClientId);
    this.auth0ClientId = await this.getSecret(clientIdKeyName);
    const clientSecretKeyName = this.settings.get(settingKeys.paramStoreAuth0ClientSecret);
    this.auth0ClientSecret = await this.getSecret(clientSecretKeyName);
  }

  async getSecret(keyName) {
    const aws = await this.service('aws');
    const ssm = new aws.sdk.SSM({ apiVersion: '2014-11-06' });

    this.log.info(`Getting the "${keyName}" key from the parameter store`);
    const result = await ssm.getParameter({ Name: keyName, WithDecryption: true }).promise();
    return result.Parameter.Value;
  }

  async getAuth0Token() {
    const options = {
      method: 'POST',
      url: `https://${this.auth0Domain}/oauth/token`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      form: {
        grant_type: 'client_credentials',
        client_id: `${this.auth0ClientId}`,
        client_secret: `${this.auth0ClientSecret}`,
        audience: `https://${this.auth0Domain}/api/v2/`,
      },
    };
    return new Promise(function(resolve, reject) {
      // Do async job
      request(options, function(error, response, body) {
        if (error) {
          reject(error);
        } else {
          let json_body = JSON.parse(body);
          resolve(json_body.access_token);
        }
      });
    });
  }

  async getIdproviders(token, user_id) {
    const options = {
      method: 'GET',
      url: `https://${this.auth0Domain}/api/v2/users/${user_id}`,
      headers: { authorization: `Bearer ${token}` },
    };
    return new Promise(function(resolve, reject) {
      // Do async job
      request(options, function(error, response, body) {
        if (error) {
          reject(error);
        } else {
          let json_res = JSON.parse(body);
          let res = json_res.identities;
          resolve(res);
        }
      });
    });
  }

  async getConnectionId(token) {
    const options = {
      method: 'GET',
      url: `https://${this.auth0Domain}/api/v2/connections?strategy=auth0`,
      headers: { authorization: `Bearer ${token}` },
    };
    return new Promise(function(resolve, reject) {
      // Do async job
      request(options, function(error, response, body) {
        if (error) {
          reject(error);
        } else {
          let json_arr = JSON.parse(body);
          let res = json_arr[0];
          resolve(res.id);
        }
      });
    });
  }

  async uploadUsersFile(userContent, token, auth0ConnectionId) {
    var metadata = {
      connection_id: auth0ConnectionId,
      upsert: true,
      send_completion_email: false,
    };
    var boundary = '--xxxxxxxxxx';
    var data = '';
    for (var i in metadata) {
      if ({}.hasOwnProperty.call(metadata, i)) {
        data += '--' + boundary + '\r\n';
        data += 'Content-Disposition: form-data; name="' + i + '"; \r\n\r\n' + metadata[i] + '\r\n';
      }
    }
    data += '--' + boundary + '\r\n';
    data += 'Content-Disposition: form-data; name="file"; filename="' + 'userData.json' + '"\r\n';
    var payload = Buffer.concat([
      Buffer.from(data, 'utf8'),
      Buffer.from(userContent, 'binary'),
      Buffer.from('\r\n--' + boundary + '\r\n', 'utf8'),
    ]);
    var options = {
      method: 'POST',
      url: `https://${this.auth0Domain}/api/v2/jobs/users-imports`,
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        authorization: `Bearer ${token}`,
      },
      body: payload,
    };
    request(options, function(error, response, body) {
      console.log(body);
    });
  }

  async auth0UserToAppUser(userContent, requestContext) {
    const userService = await this.service('userService');

    for (let i in userContent) {
      const auth0User = userContent[i];
      const isAdmin = auth0User.isAdmin === true;
      let dbmiProjectId = _.isEmpty(auth0User.dbmiProjectId) ? [] : auth0User.dbmiProjectId;
      let toCreateUser = {
        username: auth0User.email,
        email: auth0User.email,
        isAdmin,
        userRole: auth0User.userRole,
        authenticationProviderId: auth0User.authenticationProviderId,
        identityProviderName: auth0User.identityProviderName,
        status: 'active',
        dbmiProjectId,
      };
      if (!_.isEmpty(toCreateUser.email)) {
        const user = await userService.findUser({
          username: toCreateUser.username,
          authenticationProviderId: toCreateUser.authenticationProviderId,
          identityProviderName: toCreateUser.identityProviderName,
        });
        if (!user) {
          try {
            await userService.createUser(getSystemRequestContext(), toCreateUser);
          } catch (err) {
            this.log.error(err);
            throw this.boom.internalError('error creating user');
          }
        }
      }
    }
  }
}

module.exports = Auth0Service;
