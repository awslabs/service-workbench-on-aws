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
const Resource = require('../base/resource');

class AuthenticationIdToken extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'idToken',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [idToken]');
  }

  async cleanup() {
    return this.parent.parent.logout();
  }

  // ************************ Helpers methods ************************
}

module.exports = AuthenticationIdToken;
