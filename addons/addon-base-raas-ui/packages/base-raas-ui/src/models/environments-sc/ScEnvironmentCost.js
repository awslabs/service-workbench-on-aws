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
