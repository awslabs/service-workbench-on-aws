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

const CollectionResource = require('../base/collection-resource');
const User = require('./user');

class Users extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'users',
      childType: 'user',
      childIdProp: 'uid',
    });

    this.api = '/api/users';
  }

  // Because Users is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling user(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.users.user(<id>)
  user(id) {
    return new User({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(user = {}) {
    const gen = this.setup.gen;
    const username = user.username || gen.username();
    return {
      username,
      email: username,
      password: gen.password(),
      firstName: gen.firstName(),
      lastName: gen.lastName(),
      isAdmin: false,
      status: 'active',
      projectId: [this.setup.defaults.project.id],
      userRole: 'researcher',
      ...user,
    };
  }

  // ************************ Helpers methods ************************

  async deactivateUser(user) {
    const resource = new User({ clientSession: this.clientSession, id: user.uid, parent: this });
    return resource.update({ status: 'inactive', rev: user.rev });
  }

  async bulkAddUsers(users) {
    return this.doCall(async () => this.axiosClient.post(`${this.api}/bulk`, users));
  }
}

module.exports = Users;
