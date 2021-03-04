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

const Resource = require('./base/resource');

// In SWB, the user resource is mounted on two different namespaces: /api/users and /api/user
// The /api/user resource is meant to represent the current user.  This file represents the
// resource operations helper for /api/user. To represent the /api/user, see the user.js file
class CurrentUser extends Resource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'currentUser',
    });

    this.api = '/api/user';
  }

  // ************************ Helpers methods ************************
}

module.exports = CurrentUser;
