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
const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  awsRegion: 'awsRegion',
};

// WARNING WARNING WARNING WARNING
// This service has very limited functionality at the moment.
// Most of the prices are hard coded in the configuration and not calculated by
// this service. This service needs to be modified to allow for extension points, etc.
// At this time (05/12/20), this service only calculates the average of the spot prices
// for ec2 instances used in EMR.
class ComputePriceService extends Service {
  constructor() {
    super();
    this.dependency(['aws']);
  }

  // Looks at the existing computeConfiguration.princeInfo object and returns a new one
  // with calculated prices (when applicable). IMPORTANT: please read the class top comments.
  async calculatePriceInfo(computeConfiguration) {
    // We don't check for any permissions here. This service is considered lower level service,
    // and most of the time it is not directly interacting with controllers.
    //
    // Future enhancement should be to add extension points

    const region = this.settings.get(settingKeys.awsRegion);
    const configType = computeConfiguration.type;
    const originalPrinceInfo = computeConfiguration.priceInfo || {};
    let priceInfo;

    // This switch logic should be eventually turned into an extension point
    switch (configType) {
      case 'emr':
        priceInfo = await this.computeEmrPrice(computeConfiguration);
        break;
      default:
        priceInfo = { ...originalPrinceInfo, region };
    }

    return priceInfo;
  }

  // LIMITATION: this method calls ec2.describeSpotPriceHistory API which is throttle (100 requests per second)
  // https://docs.aws.amazon.com/AWSEC2/latest/APIReference/throttling.html
  async computeEmrPrice(configuration) {
    // example of priceInfo => { value: 0.504, unit: 'USD', timeUnit: 'hour', type: 'onDemand', region: 'us-east-1', spotBidPrice: (if type is 'spot') },
    const originalPrinceInfo = configuration.priceInfo || {};
    if (originalPrinceInfo.timeUnit !== 'hour')
      return this.boom.badRequest('Pricing with a time unit other than "hour" is not supported', true);

    const region = this.settings.get(settingKeys.awsRegion);
    const priceType = originalPrinceInfo.type; // can be onDemand or spot
    const getParam = (name) => {
      // First we see if the paramter is considered immutable, if so, we return its immutable value
      // otherwise we return the mutable value if it exists
      const immutable = _.get(configuration, ['params', 'immutable', name]);
      if (!_.isUndefined(immutable)) return immutable;
      return _.get(configuration, ['params', 'mutable', name]);
    };
    const emr = getParam('emr') || {};
    const ec2Type = emr.workerInstanceSize;
    const ec2Count = emr.workerInstanceCount;
    const ec2OnDemandPrice = emr.workerInstanceOnDemandPrice;
    const ec2MasterOnDemandPrice = emr.masterInstanceOnDemandPrice;
    const spotBidMultiplier = getParam('spotBidMultiplier');

    if (priceType === 'onDemand') {
      return { ...originalPrinceInfo, region, value: ec2MasterOnDemandPrice + ec2Count * ec2OnDemandPrice };
    }

    if (priceType !== 'spot') return originalPrinceInfo;

    const priceHistory = await this.getSpotPriceHistory(ec2Type, region);
    let bidPrice = ec2OnDemandPrice;
    if (!_.isEmpty(priceHistory)) {
      const average = _.sum(_.map(priceHistory, (item) => item.spotPrice)) / priceHistory.length;
      bidPrice = average * spotBidMultiplier;
    }

    return {
      ...originalPrinceInfo,
      region,
      value: ec2MasterOnDemandPrice + ec2Count * bidPrice,
      spotBidPrice: bidPrice,
      spotBidMultiplier,
    };
  }

  async getSpotPriceHistory(ec2Type, region = 'us-east-1') {
    const aws = await this.service('aws');

    const ec2 = new aws.sdk.EC2({
      region,
    });

    const { SpotPriceHistory } = await ec2
      .describeSpotPriceHistory({
        InstanceTypes: [ec2Type],
        ProductDescriptions: ['Linux/UNIX'],
        StartTime: new Date(),
      })
      .promise();

    return SpotPriceHistory.map(({ AvailabilityZone, SpotPrice }) => ({
      availabilityZone: AvailabilityZone,
      spotPrice: parseFloat(SpotPrice),
    }));
  }
}

module.exports = ComputePriceService;
