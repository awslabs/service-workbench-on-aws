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

/* eslint-disable import/prefer-default-export */
import _ from 'lodash';
import { types, applySnapshot } from 'mobx-state-tree';

// ==================================================================
// ScEnvironmentCost
// ==================================================================
const ScEnvironmentCost = types
  .model('ScEnvironmentCost', {
    id: types.identifier, // this will be at the client side which is the same as the env id + 'cost' as suffix
    entries: types.frozen([]),
    error: '',
  })
  .actions(self => ({
    setScEnvironmentCost(rawData) {
      applySnapshot(self, rawData);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get previousDayCost() {
      // We are making this assumption:
      // - the last element in the entries is assumed to be the previousDay entry
      const entry = _.last(self.entries);
      if (_.isEmpty(entry)) {
        return 0;
      }

      // entry has this shape {
      //  startDate: '20xx-xx-xx':
      //  cost: {
      //    <service name1>: { amount, unit },
      //    <service name2>: { amount, unit },
      //    ...
      //  }
      // }
      return self.getAmount(entry);
    },

    getAmount(entry) {
      return _.sum(_.map(entry.cost, value => _.get(value, 'amount', 0)));
    },

    // Returns an array of objects, with two props.
    // Example: [ { date: '2020-07-20', amount: 100.0, unit: 'USD' }, ... ]
    get list() {
      const result = _.map(self.entries, entry => ({
        date: entry.startDate,
        amount: self.getAmount(entry),
        unit: entry.unit,
      }));

      return result;
    },
  }));

export { ScEnvironmentCost };
