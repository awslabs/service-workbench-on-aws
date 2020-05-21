const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

const { getPlatforms } = require('./data/compute-platforms');
const { getConfigurations } = require('./data/compute-configurations');

/**
 * The purpose of this service is to answer questions like:
 * - What are the available compute platforms given a user?
 * - What are the available compute configurations for a given compute platform given a user?
 *   - For certain compute configurations, pricing is also computed on the fly rather than hard coded.
 */
class ComputePlatformService extends Service {
  constructor() {
    super();
    this.dependency(['computePriceService']);
  }

  // This method expects requestContext.principal object to be fully populated
  // eslint-disable-next-line no-unused-vars
  async listPlatforms(requestContext) {
    return getPlatforms(requestContext.principal);
  }

  // eslint-disable-next-line no-unused-vars
  async listConfigurations(requestContext, { platformId = '', includePrice = false } = {}) {
    const [priceService] = await this.service(['computePriceService']);
    const user = requestContext.principal;

    // Check if the user can view the platformId before returning the configurations
    const allowedPlatforms = getPlatforms(user) || [];
    if (!_.some(allowedPlatforms, ['id', platformId])) return [];

    const configurations = getConfigurations(platformId, user);
    const doWork = async configuration => {
      const priceInfo = await priceService.calculatePriceInfo(configuration);
      configuration.priceInfo = priceInfo;
    };

    if (includePrice) {
      await processInBatches(configurations, 10, doWork);
    }

    return configurations;
  }
}

module.exports = ComputePlatformService;
