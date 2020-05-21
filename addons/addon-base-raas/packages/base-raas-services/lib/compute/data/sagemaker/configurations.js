// A temporarily place to keep the information about the compute configurations
const _ = require('lodash');

const configurations = [
  {
    id: 'sagemaker__small',
    type: 'sagemaker',
    title: 'Small',
    displayOrder: 1,
    priceInfo: { value: 0.0464, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
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
    ],
    params: {
      immutable: {
        size: 'ml.t2.medium',
        cidr: '0.0.0.0/0',
      },
      mutable: {},
    },
  },
  {
    id: 'sagemaker__medium',
    type: 'sagemaker',
    title: 'Medium',
    displayOrder: 2,
    price: 1.075,
    priceInfo: { value: 1.075, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc: 'A medium research workspace meant for average sized problems.',
    displayProps: [
      {
        key: 'vCPU',
        value: '32',
      },
      {
        key: 'Memory (GiB)',
        value: '128',
      },
    ],
    params: {
      immutable: {
        size: 'ml.m5.4xlarge',
        cidr: '0.0.0.0/0',
      },
      mutable: {},
    },
  },
  {
    id: 'sagemaker__large',
    type: 'sagemaker',
    title: 'Large',
    displayOrder: 3,
    priceInfo: { value: 6.451, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc: 'A large research workspace meant for the largest of problems. It costs the most amount per hour.',
    displayProps: [
      {
        key: 'vCPU',
        value: '96',
      },
      {
        key: 'Memory (GiB)',
        value: '384',
      },
    ],
    params: {
      immutable: {
        size: 'ml.m5.24xlarge',
        cidr: '0.0.0.0/0',
      },
      mutable: {},
    },
  },
];

// These configurations belong to which compute platform ids
const filterByType = platformId => (['sagemaker-1'].includes(platformId) ? _.slice(configurations) : []);

// Which user can view which configuration
const getConfigurations = platformId => filterByType(platformId); // All users can see all configurations

module.exports = {
  getConfigurations,
};
