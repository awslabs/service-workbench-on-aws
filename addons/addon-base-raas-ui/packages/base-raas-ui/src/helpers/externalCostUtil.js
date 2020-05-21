import _ from 'lodash';
import { EnvironmentConfigurationsStore } from '../models/environments/EnvironmentConfigurationsStore';

const getEstimatedCost = async (env, numberOfDaysToGetCostInfo) => {
  const envConfig = EnvironmentConfigurationsStore.create();
  await envConfig.load();
  const allEnvConfigs = envConfig.list;
  const config = _.find(allEnvConfigs, conf => {
    // Hail EMR has spot pricing and on demand price. o we need to pick the correct EMR env config
    if (env.instanceInfo.type === 'emr') {
      if (env.instanceInfo.config.spotBidPrice) {
        return (
          conf.type === env.instanceInfo.type && conf.size === env.instanceInfo.size && conf.label.includes('Spot')
        );
      }
      return (
        conf.type === env.instanceInfo.type && conf.size === env.instanceInfo.size && conf.label.includes('On Demand')
      );
    }
    return conf.type === env.instanceInfo.type && conf.size === env.instanceInfo.size;
  });
  const cost = {};
  cost[config.type] = {
    amount: config.totalPrice,
    unit: 'USD',
  };

  const allCost = [];
  for (let i = numberOfDaysToGetCostInfo; i > 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const costForDay = {
      startDate: day,
      cost,
    };
    allCost.push(costForDay);
  }
  return allCost;
};

// eslint-disable-next-line import/prefer-default-export
export { getEstimatedCost };
