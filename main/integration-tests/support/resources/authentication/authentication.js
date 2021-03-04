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

const Resource = require('../base/resource');
const AuthenticationIdTokens = require('./authentication-id-tokens');
const AuthenticationProviderTypes = require('./authentication-provider-types');
const AuthenticationProviderConfigs = require('./authentication-provider-configs');

class Authentication extends Resource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'authentication',
    });
    this.api = '/api/authentication';
  }

  configs() {
    return new AuthenticationProviderConfigs({ clientSession: this.clientSession, parent: this });
  }

  types() {
    return new AuthenticationProviderTypes({ clientSession: this.clientSession, parent: this });
  }

  idTokens() {
    return new AuthenticationIdTokens({ clientSession: this.clientSession, parent: this });
  }

  async logout() {
    return this.doCall(async () => this.axiosClient.post(`${this.api}/logout`));
  }

  // ************************ Helpers methods ************************
}

module.exports = Authentication;
