import { applySnapshot, types } from 'mobx-state-tree';
import { getEnvironmentSpotPriceHistory } from '../../helpers/api';

const SpotPriceHistoryItem = types.model('SpotPriceHistoryItem', {
  availabilityZone: '',
  spotPrice: types.number,
});

const EnvironmentConfiguration = types
  .model('EnvironmentConfiguration', {
    id: types.identifier,
    type: '',
    size: '',
    label: '',
    price: types.number,
    description: '',
    defaultCidr: '',
    properties: types.frozen(),
    spotBidMultiplier: types.optional(types.number, 0),
    spotPriceHistory: types.optional(types.array(SpotPriceHistoryItem), []),
    emrConfiguration: types.frozen(),
  })
  .actions(self => ({
    setEnvironmentConfiguration(configuration) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      const fetchingSpotPriceHistory = self.fetchingSpotPriceHistory;
      applySnapshot(self, configuration);
      self.fetchingSpotPriceHistory = fetchingSpotPriceHistory;
    },

    async getSpotPriceHistory() {
      const spotInstance = self.isEmrCluster ? self.emrConfiguration.workerInstanceSize : self.size;
      const prices = await getEnvironmentSpotPriceHistory(spotInstance);

      self.setSpotPriceHistory(prices);
    },

    setSpotPriceHistory(prices) {
      self.spotPriceHistory = prices;
    },
  }))
  .views(self => ({
    get isOnDemandPricing() {
      return !self.spotBidMultiplier;
    },

    get isEmrCluster() {
      return !!self.emrConfiguration;
    },

    get hasSpotPriceHistory() {
      return self.spotPriceHistory.length > 0;
    },

    get averageSpotPriceHistory() {
      if (self.hasSpotPriceHistory) {
        return self.spotPriceHistory.reduce(
          (result, { spotPrice }) => result + spotPrice / self.spotPriceHistory.length,
          0,
        );
      }
      self.getSpotPriceHistory();
      return 0;
    },

    get spotBidPrice() {
      return self.averageSpotPriceHistory * self.spotBidMultiplier;
    },

    get isLoadingPrice() {
      return this.isOnDemandPricing ? false : self.averageSpotPriceHistory === 0;
    },

    get totalPrice() {
      if (self.isOnDemandPricing && !self.isEmrCluster) {
        return self.price * 24;
      }
      if (self.isOnDemandPricing && self.isEmrCluster) {
        const { workerInstanceOnDemandPrice, workerInstanceCount } = self.emrConfiguration;
        return (self.price + workerInstanceOnDemandPrice * workerInstanceCount) * 24;
      }
      // this is now a spot bid below the onDemand cost
      if (self.isEmrCluster) {
        const { workerInstanceCount } = self.emrConfiguration;
        return (self.price + self.spotBidPrice * workerInstanceCount) * 24;
      }
      // last option is spot single node
      return self.spotBidPrice * 24;
    },
  }));

// eslint-disable-next-line import/prefer-default-export
export { EnvironmentConfiguration };
