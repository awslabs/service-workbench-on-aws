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
const Connections = require('./connections/connections');

class WorkspaceServiceCatalog extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'workspaceServiceCatalog',
      id,
      parent,
    });

    if (_.isEmpty(parent))
      throw Error('A parent resource was not provided to resource type [workspace-service-catalog]');
  }

  connections() {
    return new Connections({ clientSession: this.clientSession, parent: this });
  }

  async stop() {
    const api = `${this.api}/stop`;

    return this.doCall(async () => this.axiosClient.put(api, {}, {}));
  }

  async start() {
    const api = `${this.api}/start`;

    return this.doCall(async () => this.axiosClient.put(api, {}, {}));
  }

  async cidr(body) {
    const api = `${this.api}/cidr`;

    return this.doCall(async () => this.axiosClient.put(api, body, {}));
  }

  // ************************ Helpers methods ************************
}

module.exports = WorkspaceServiceCatalog;
