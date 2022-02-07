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

class Migration extends Resource {
  constructor({ clientSession }) {
    super({ clientSession, type: 'migration' });

    this.api = 'api/migrate';
  }

  // ************************ Helpers methods ************************
  listInternaAuthUserMyStudies() {
    const api = `${this.api}/my-studies`;

    return this.doCall(async () => this.axiosClient.get(api));
  }

  migrateMyStudyOwnership(body) {
    const api = `${this.api}/my-studies`;

    return this.doCall(async () => this.axiosClient.put(api, body));
  }
}

module.exports = Migration;
