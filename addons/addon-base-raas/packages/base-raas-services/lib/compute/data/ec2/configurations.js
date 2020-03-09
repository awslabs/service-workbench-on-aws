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

const configurations = [
  {
    id: 'ec2-linux_small',
    type: 'ec2-linux',
    title: 'Small',
    displayOrder: 1,
    priceInfo: { value: 0.504, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc:
      'A small environment is meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour.',
    displayProps: [
      {
        key: 'vCPU',
        value: '8',
      },
      {
        key: 'Memory (GiB)',
        value: '64',
      },
    ],
    params: {
      immutable: {
        size: 'r5.2xlarge',
      },
      mutable: {
        cidr: '',
      },
    },
  },
  {
    id: 'ec2-linux_medium',
    type: 'ec2-linux',
    title: 'Medium',
    displayOrder: 2,
    priceInfo: { value: 2.016, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc: 'A medium environment is meant for average sized problems.',
    displayProps: [
      {
        key: 'vCPU',
        value: '32',
      },
      {
        key: 'Memory (GiB)',
        value: '256',
      },
    ],
    params: {
      immutable: {
        size: 'r5.8xlarge',
      },
      mutable: {
        cidr: '',
      },
    },
  },
  {
    id: 'ec2-linux_large',
    type: 'ec2-linux',
    title: 'Large',
    displayOrder: 3,
    priceInfo: { value: 4.032, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc: 'A large environment is meant for the largest of problems. It costs the most amount per hour.',
    displayProps: [
      {
        key: 'vCPU',
        value: '64',
      },
      {
        key: 'Memory (GiB)',
        value: '512',
      },
    ],
    params: {
      immutable: {
        size: 'r5.16xlarge',
      },
      mutable: {
        cidr: '',
      },
    },
  },
  {
    id: 'ec2-windows_small',
    type: 'ec2-windows',
    title: 'Small',
    displayOrder: 4,
    priceInfo: { value: 0.872, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc:
      'A small environment is meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour.',
    displayProps: [
      {
        key: 'vCPU',
        value: '8',
      },
      {
        key: 'Memory (GiB)',
        value: '64',
      },
    ],
    params: {
      immutable: {
        size: 'r5.2xlarge',
      },
      mutable: {
        cidr: '',
      },
    },
  },
  {
    id: 'ec2-windows_medium',
    type: 'ec2-windows',
    title: 'Medium',
    displayOrder: 5,
    priceInfo: { value: 3.488, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc: 'A medium environment is meant for average sized problems.',
    displayProps: [
      {
        key: 'vCPU',
        value: '32',
      },
      {
        key: 'Memory (GiB)',
        value: '256',
      },
    ],
    params: {
      immutable: {
        size: 'r5.8xlarge',
      },
      mutable: {
        cidr: '',
      },
    },
  },
  {
    id: 'ec2-windows_large',
    type: 'ec2-windows',
    title: 'Large',
    displayOrder: 1,
    priceInfo: { value: 6.976, unit: 'USD', timeUnit: 'hour', type: 'onDemand' },
    desc: 'A large environment is meant for the largest of problems. It costs the most amount per hour.',
    displayProps: [
      {
        key: 'vCPU',
        value: '64',
      },
      {
        key: 'Memory (GiB)',
        value: '512',
      },
    ],
    params: {
      immutable: {
        size: 'r5.16xlarge',
      },
      mutable: {
        cidr: '',
      },
    },
  },
];

const filterByType = platformId => {
  const map = { 'ec2-linux-1': 'ec2-linux', 'ec2-windows-1': 'ec2-windows' };
  const type = map[platformId];
  return _.filter(configurations, ['type', type]);
};

// Which user can view which configuration
const getConfigurations = (platformId, user) =>
  _.get(user, 'userRole') !== 'external-researcher' ? filterByType(platformId) : []; // external researchers can't view ec2 configurations for now

module.exports = {
  getConfigurations,
};
