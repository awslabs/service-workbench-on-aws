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

class Costs extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'costs',
    });

    this.api = '/api/costs';
  }

  // ************************ Helpers methods ************************
  async getIndexCosts() {
    // Future: Need to rename the param 'proj' to 'index' since we're required to pass the Index ID value to it
    return this.get({ numberOfDaysInPast: 1, proj: this.setup.defaults.index.id });
  }
}

module.exports = Costs;
