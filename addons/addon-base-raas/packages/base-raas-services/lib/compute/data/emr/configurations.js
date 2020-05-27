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

// A temporarily place to keep the information about the compute configurations
const _ = require('lodash');

// IMPORTANT - IMPORTANT - IMPORTANT
// All spot priceInfo will be calculated by the pricing service
const configurations = [
  {
    id: 'emr_small',
    type: 'emr',
    title: 'Small - On Demand',
    displayOrder: 1,
    priceInfo: { value: undefined, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc:
      'A small research workspace meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour.',
    displayProps: [
      {
        key: 'vCPU',
        value: '4',
      },
      {
        key: 'Memory (GiB)',
        value: '16',
      },
      {
        key: 'Worker nodes',
        value: '1',
      },
    ],
    params: {
      immutable: {
        size: 'm5.xlarge',
        emr: {
          masterInstanceOnDemandPrice: 0.192,
          workerInstanceSize: 'm5.xlarge',
          workerInstanceCount: 1,
          workerInstanceOnDemandPrice: 0.192,
          diskSizeGb: 10,
        },
      },
      mutable: {
        cidr: '',
      },
    },
  },

  {
    id: 'emr_small_spot',
    type: 'emr',
    title: 'Small - Spot',
    displayOrder: 2,
    priceInfo: { value: undefined, unit: 'USD', timeUnit: 'hour', type: 'spot' },
    desc:
      'A small research workspace meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour. This research workspace uses spot pricing for worker nodes with a maximum price of 1.3x the spot history price.',
    displayProps: [
      {
        key: 'vCPU',
        value: '4',
      },
      {
        key: 'Memory (GiB)',
        value: '16',
      },
      {
        key: 'Worker nodes',
        value: '1',
      },
    ],
    params: {
      immutable: {
        size: 'm5.xlarge',
        spotBidMultiplier: 1.3,
        emr: {
          masterInstanceOnDemandPrice: 0.192,
          workerInstanceSize: 'm5.xlarge',
          workerInstanceCount: 1,
          workerInstanceOnDemandPrice: 0.192,
          diskSizeGb: 10,
        },
      },
      mutable: {
        cidr: '',
      },
    },
  },

  {
    id: 'emr_medium',
    type: 'emr',
    title: 'Medium - On Demand',
    displayOrder: 3,
    priceInfo: { value: undefined, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc:
      'A medium research workspace meant for average sized problems. This research workspace uses spot pricing for worker nodes with a maximum price of the on demand price.',
    displayProps: [
      {
        key: 'vCPU',
        value: '4',
      },
      {
        key: 'Memory (GiB)',
        value: '16',
      },
      {
        key: 'Worker nodes',
        value: '8',
      },
    ],
    params: {
      immutable: {
        size: 'm5.xlarge',
        emr: {
          masterInstanceOnDemandPrice: 0.192,
          workerInstanceSize: 'm5.xlarge',
          workerInstanceCount: 8,
          workerInstanceOnDemandPrice: 0.192,
          diskSizeGb: 10,
        },
      },
      mutable: {
        cidr: '',
      },
    },
  },

  {
    id: 'emr_medium_spot',
    type: 'emr',
    title: 'Medium - Spot',
    displayOrder: 4,
    priceInfo: { value: undefined, unit: 'USD', timeUnit: 'hour', type: 'spot' },
    desc:
      'A medium research workspace meant for average sized problems. This research workspace uses spot pricing for worker nodes with a maximum price of 1.3x the spot history price.',
    displayProps: [
      {
        key: 'vCPU',
        value: '4',
      },
      {
        key: 'Memory (GiB)',
        value: '16',
      },
      {
        key: 'Worker nodes',
        value: '8',
      },
    ],
    params: {
      immutable: {
        spotBidMultiplier: 1.3,
        size: 'm5.xlarge',
        emr: {
          masterInstanceOnDemandPrice: 0.192,
          workerInstanceSize: 'm5.xlarge',
          workerInstanceCount: 8,
          workerInstanceOnDemandPrice: 0.192,
          diskSizeGb: 10,
        },
      },
      mutable: {
        cidr: '',
      },
    },
  },

  {
    id: 'emr_large',
    type: 'emr',
    title: 'Large - On Demand',
    displayOrder: 5,
    priceInfo: { value: undefined, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc:
      'A large research workspace meant for the largest of problems. It costs the most amount per hour. This research workspace uses spot pricing for worker nodes with a maximum price of the on demand price.',
    displayProps: [
      {
        key: 'vCPU',
        value: '96',
      },
      {
        key: 'Memory (GiB)',
        value: '384',
      },
      {
        key: 'Worker nodes',
        value: '8',
      },
    ],
    params: {
      immutable: {
        size: 'm5.24xlarge',
        emr: {
          masterInstanceOnDemandPrice: 0.192,
          workerInstanceSize: 'm5.24xlarge',
          workerInstanceCount: 8,
          workerInstanceOnDemandPrice: 4.608,
          diskSizeGb: 10,
        },
      },
      mutable: {
        cidr: '',
      },
    },
  },

  {
    id: 'emr_large_spot',
    type: 'emr',
    title: 'Large - Spot',
    displayOrder: 6,
    priceInfo: { value: undefined, unit: 'USD', timeUnit: 'hour', type: 'spot' },
    desc:
      'A large research workspace meant for the largest of problems. It costs the most amount per hour. This research workspace uses spot pricing for worker nodes with a maximum price of 1.3x the spot history price.',
    displayProps: [
      {
        key: 'vCPU',
        value: '96',
      },
      {
        key: 'Memory (GiB)',
        value: '384',
      },
      {
        key: 'Worker nodes',
        value: '8',
      },
    ],
    params: {
      immutable: {
        size: 'm5.24xlarge',
        spotBidMultiplier: 1.3,
        emr: {
          masterInstanceOnDemandPrice: 0.192,
          workerInstanceSize: 'm5.24xlarge',
          workerInstanceCount: 8,
          workerInstanceOnDemandPrice: 4.608,
          diskSizeGb: 10,
        },
      },
      mutable: {
        cidr: '',
      },
    },
  },
];

// These configurations belong to which compute platform ids
const filterByType = platformId => (['emr-1'].includes(platformId) ? _.slice(configurations) : []);

// Which user can view which configuration
const getConfigurations = (platformId, _user) => filterByType(platformId); // All users can see all configurations

module.exports = {
  getConfigurations,
};
