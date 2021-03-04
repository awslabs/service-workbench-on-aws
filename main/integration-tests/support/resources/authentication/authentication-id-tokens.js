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
const AuthenticationIdToken = require('./authentication-id-token');

class AuthenticationIdTokens extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'idTokens',
      parent,
      childType: 'idToken',
      childIdProp: 'username',
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [idTokens]');
    this.api = `${parent.api}/id-tokens`;
  }

  idToken(username) {
    return new AuthenticationIdToken({ clientSession: this.clientSession, id: username, parent: this });
  }

  // ************************ Helpers methods ************************
}

module.exports = AuthenticationIdTokens;
