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

const { sleep } = require('@aws-ee/base-services/lib/helpers/utils');

const Resource = require('../base/resource');
const Configurations = require('./configurations/configurations');
const ConfigVars = require('./config-vars/config-vars');

class WorkspaceType extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'workspaceType',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [workspace-type]');
  }

  configurations() {
    return new Configurations({ clientSession: this.clientSession, parent: this });
  }

  configVars() {
    return new ConfigVars({ clientSession: this.clientSession, parent: this });
  }

  async approve(body) {
    const api = `${this.api}/approve`;
    const response = await this.doCall(async () => this.axiosClient.put(api, body, {}));

    await sleep(this.deflakeDelay());
    return response;
  }

  async revoke(body) {
    const api = `${this.api}/revoke`;
    const response = await this.doCall(async () => this.axiosClient.put(api, body, {}));

    await sleep(this.deflakeDelay());
    return response;
  }

  // ************************ Helpers methods ************************
}

module.exports = WorkspaceType;
