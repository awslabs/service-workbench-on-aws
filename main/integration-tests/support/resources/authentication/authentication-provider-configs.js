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

const CollectionResource = require('../base/collection-resource');

class AuthenticationProviderConfigs extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'authProviderConfigs',
      parent,
    });
    this.api = `${parent.api}/provider/configs`;

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [providerConfigs]');
  }

  defaults({
    providerConfigId = this.setup.gen.string({ prefix: 'auth-prov-test-config-id' }),
    providerTypeId = this.setup.gen.string({ prefix: 'auth-prov-test-type-id' }),
    description = this.setup.gen.description(),
  } = {}) {
    return {
      providerConfig: {
        id: providerConfigId,
        title: description,
      },
      providerTypeId,
    };
  }

  // ************************ Helpers methods ************************
  defaultConfigs() {
    return {
      id: `https://cognito-idp.${this.setup.defaults.awsRegion}.amazonaws.com/${this.setup.defaults.userPoolId}`,
      status: 'active',
    };
  }
}

module.exports = AuthenticationProviderConfigs;
