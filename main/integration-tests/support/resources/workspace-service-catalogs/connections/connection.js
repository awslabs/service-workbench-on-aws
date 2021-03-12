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

const Resource = require('../../base/resource');

class Connection extends Resource {
  constructor({ clientSession, id, parent }) {
    super({
      clientSession,
      type: 'connection',
      id,
      parent,
    });

    if (_.isEmpty(parent)) throw Error('A parent resource was not provided to resource type [connection]');
  }

  async createUrl() {
    const api = `${this.api}/url`;
    const response = await this.doCall(async () => this.axiosClient.post(api, {}, {}));

    await sleep(this.deflakeDelay());
    return response;
  }

  async windowsRdpInfo() {
    const api = `${this.api}/windows-rdp-info`;

    return this.doCall(async () => this.axiosClient.get(api, {}, {}));
  }

  async sendSshPublicKey(body) {
    const api = `${this.api}/send-ssh-public-key`;
    const response = await this.doCall(async () => this.axiosClient.post(api, body, {}));

    await sleep(this.deflakeDelay());
    return response;
  }

  // ************************ Helpers methods ************************
}

module.exports = Connection;
