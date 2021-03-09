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

const CollectionResource = require('../../base/collection-resource');
const Connection = require('./connection');

class Connections extends CollectionResource {
  constructor({ clientSession, parent }) {
    super({
      clientSession,
      type: 'connections',
      childType: 'connection',
    });

    this.api = `${parent.api}/connections`;
  }

  // Because Connections is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling connection(id).
  connection(id) {
    return new Connection({ clientSession: this.clientSession, id, parent: this });
  }

  // ************************ Helpers methods ************************
}

module.exports = Connections;
