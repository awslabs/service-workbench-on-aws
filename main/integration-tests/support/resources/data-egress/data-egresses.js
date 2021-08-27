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
const DataEgress = require('./data-egress');
const DataEgressNotify = require('./data-egress-notify');

class DataEgresses extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'dataEgresses',
      childType: 'dataEgress',
      childIdProp: 'id',
    });

    this.api = '/api/data-egress';
  }

  dataEgress(id) {
    return new DataEgress({ clientSession: this.clientSession, id, parent: this });
  }

  // ************************ Helpers methods ************************
  notify() {
    return new DataEgressNotify({ clientSession: this.clientSession, parent: this });
  }
}

module.exports = DataEgresses;
