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
const CollectionResource = require('../base/collection-resource');
const Budget = require('./budget');

class Indexes extends CollectionResource {
  constructor({ clientSession }) {
    super({
      clientSession,
      type: 'budgets',
      childType: 'budget',
      childIdProp: 'id',
    });

    this.api = '/api/budgets/aws-account';
  }

  // Because Indexes is a collection resource type, it is assumed that accessing the resource helper of the
  // child resource is done by calling index(id). For example, the full access pattern to get hold of the
  // resource helper of the child resource is: session.resources.indexes.index(<id>)
  budget(id) {
    return new Budget({ clientSession: this.clientSession, id, parent: this });
  }

  // When creating a child resource, this method provides default values. This method is used by the
  // CollectionResource class when we use create() method on this resource operations helper.
  defaults(budget = {}) {
    const hammerTimeNow = Math.ceil(new Date().getTime() / 1000);
    return {
      id: budget.id,
      budgetConfiguration: {
        budgetLimit: this.setup.gen.integer().toString(),
        startDate: hammerTimeNow,
        endDate: hammerTimeNow + 30000000,
        thresholds: [50, 80, 90],
        notificationEmail: 'test@example.com',
      },
      ...budget,
    };
  }

  // ************************ Helpers methods ************************
  async mustFind(id) {
    const indexes = await this.get();
    const index = _.find(indexes, ind => ind.id === id);

    if (_.isEmpty(index)) throw new Error(`index "${id}" is not found`);
    return index;
  }
}

module.exports = Indexes;
