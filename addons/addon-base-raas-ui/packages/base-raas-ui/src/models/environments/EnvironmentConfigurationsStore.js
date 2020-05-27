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

import _ from 'lodash';
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { EnvironmentConfiguration } from './EnvironmentConfiguration';

const EnvironmentConfigurationsStore = BaseStore.named('EnvironmentConfigurationsStore')
  .props({
    configurations: types.map(EnvironmentConfiguration),
    heartbeatInterval: -1,
  })
  .actions((self) => {
    return {
      async doLoad() {
        const environmentConfigurations = await getEnvironmentConfigurations();

        self.runInAction(() => {
          consolidateToMap(self.configurations, environmentConfigurations, (exiting, newItem) => {
            exiting.setEnvironmentConfiguration(newItem);
          });
        });
      },
    };
  })

  .views((self) => ({
    get empty() {
      return self.configurations.size === 0;
    },

    get total() {
      return self.configurations.size;
    },

    get list() {
      const result = [];
      self.configurations.forEach((configuration) => result.push(configuration));

      return _.sortBy(result, ['id']);
    },

    getConfiguration(id) {
      return self.configurations.get(id);
    },
  }));

async function getEnvironmentConfigurations() {
  let idCounter = 1;
  return [
    {
      type: 'sagemaker',
      // size: 'ml.t3.xlarge',
      size: 'ml.t2.medium',
      label: 'Small',
      price: 0.0464,
      defaultCidr: '0.0.0.0/0',
      description:
        'A small research workspace meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour.',
      properties: [
        {
          key: 'vCPU',
          value: '4',
        },
        {
          key: 'Memory (GiB)',
          value: '16',
        },
      ],
    },
    {
      type: 'sagemaker',
      size: 'ml.m5.4xlarge',
      label: 'Medium',
      price: 1.075,
      defaultCidr: '0.0.0.0/0',
      description: 'A medium research workspace meant for average sized problems.',
      properties: [
        {
          key: 'vCPU',
          value: '32',
        },
        {
          key: 'Memory (GiB)',
          value: '128',
        },
      ],
    },
    {
      label: 'Large',
      type: 'sagemaker',
      size: 'ml.m5.24xlarge',
      price: 6.451,
      defaultCidr: '0.0.0.0/0',
      description: 'A large research workspace meant for the largest of problems. It costs the most amount per hour.',
      properties: [
        {
          key: 'vCPU',
          value: '96',
        },
        {
          key: 'Memory (GiB)',
          value: '384',
        },
      ],
    },
    {
      type: 'emr',
      size: 'm5.xlarge',
      label: 'Small - On Demand',
      price: 0.192,
      defaultCidr: '',
      description:
        'A small research workspace meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour.',
      emrConfiguration: {
        workerInstanceSize: 'm5.xlarge',
        workerInstanceCount: 1,
        workerInstanceOnDemandPrice: 0.192,
        diskSizeGb: 10,
      },
      properties: [
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
    },
    {
      type: 'emr',
      size: 'm5.xlarge',
      label: 'Small - Spot',
      price: 0.192,
      spotBidMultiplier: 1.3,
      emrConfiguration: {
        workerInstanceSize: 'm5.xlarge',
        workerInstanceCount: 1,
        workerInstanceOnDemandPrice: 0.192,
        diskSizeGb: 10,
      },
      defaultCidr: '',
      description:
        'A small research workspace meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour. This research workspace uses spot pricing for worker nodes with a maximum price of 1.3x the spot history price.',
      properties: [
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
    },
    {
      type: 'emr',
      size: 'm5.xlarge',
      label: 'Medium - On Demand',
      price: 0.192,
      emrConfiguration: {
        workerInstanceSize: 'm5.xlarge',
        workerInstanceCount: 8,
        workerInstanceOnDemandPrice: 0.192,
        diskSizeGb: 10,
      },
      defaultCidr: '',
      description:
        'A medium research workspace meant for average sized problems. This research workspace uses spot pricing for worker nodes with a maximum price of the on demand price.',
      properties: [
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
    },
    {
      type: 'emr',
      size: 'm5.xlarge',
      label: 'Medium - Spot',
      price: 0.192,
      spotBidMultiplier: 1.3,
      emrConfiguration: {
        workerInstanceSize: 'm5.xlarge',
        workerInstanceCount: 8,
        workerInstanceOnDemandPrice: 0.192,
        diskSizeGb: 10,
      },
      defaultCidr: '',
      description:
        'A medium research workspace meant for average sized problems. This research workspace uses spot pricing for worker nodes with a maximum price of 1.3x the spot history price.',
      properties: [
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
    },
    {
      label: 'Large - On Demand',
      type: 'emr',
      size: 'm5.xlarge',
      price: 0.192,
      emrConfiguration: {
        workerInstanceSize: 'm5.24xlarge',
        workerInstanceCount: 8,
        workerInstanceOnDemandPrice: 4.608,
        diskSizeGb: 10,
      },
      defaultCidr: '',
      description:
        'A large research workspace meant for the largest of problems. It costs the most amount per hour. This research workspace uses spot pricing for worker nodes with a maximum price of the on demand price.',
      properties: [
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
    },
    {
      label: 'Large - Spot',
      type: 'emr',
      size: 'm5.xlarge',
      price: 0.192,
      spotBidMultiplier: 1.3,
      emrConfiguration: {
        workerInstanceSize: 'm5.24xlarge',
        workerInstanceCount: 8,
        workerInstanceOnDemandPrice: 4.608,
        diskSizeGb: 10,
      },
      defaultCidr: '',
      description:
        'A large research workspace meant for the largest of problems. It costs the most amount per hour. This research workspace uses spot pricing for worker nodes with a maximum price of 1.3x the spot history price.',
      properties: [
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
    },
    {
      size: 'r5.2xlarge',
      type: 'ec2-linux',
      label: 'Small',
      defaultCidr: '',
      price: 0.504,
      description:
        'A small environment is meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour.',
      properties: [
        {
          key: 'vCPU',
          value: '8',
        },
        {
          key: 'Memory (GiB)',
          value: '64',
        },
      ],
    },
    {
      size: 'r5.8xlarge',
      type: 'ec2-linux',
      label: 'Medium',
      defaultCidr: '',
      price: 2.016,
      description: 'A medium environment is meant for average sized problems.',
      properties: [
        {
          key: 'vCPU',
          value: '32',
        },
        {
          key: 'Memory (GiB)',
          value: '256',
        },
      ],
    },
    {
      label: 'Large',
      type: 'ec2-linux',
      size: 'r5.16xlarge',
      defaultCidr: '',
      price: 4.032,
      description: 'A large environment is meant for the largest of problems. It costs the most amount per hour.',
      properties: [
        {
          key: 'vCPU',
          value: '64',
        },
        {
          key: 'Memory (GiB)',
          value: '512',
        },
      ],
    },
    {
      size: 'r5.2xlarge',
      type: 'ec2-windows',
      label: 'Small',
      defaultCidr: '',
      price: 0.872,
      description:
        'A small environment is meant for prototyping and proving out scripts before scaling up to a larger. It costs the least amount per hour.',
      properties: [
        {
          key: 'vCPU',
          value: '8',
        },
        {
          key: 'Memory (GiB)',
          value: '64',
        },
      ],
    },
    {
      size: 'r5.8xlarge',
      type: 'ec2-windows',
      label: 'Medium',
      defaultCidr: '',
      price: 3.488,
      description: 'A medium environment is meant for average sized problems.',
      properties: [
        {
          key: 'vCPU',
          value: '32',
        },
        {
          key: 'Memory (GiB)',
          value: '256',
        },
      ],
    },
    {
      label: 'Large',
      type: 'ec2-windows',
      size: 'r5.16xlarge',
      defaultCidr: '',
      price: 6.976,
      description: 'A large environment is meant for the largest of problems. It costs the most amount per hour.',
      properties: [
        {
          key: 'vCPU',
          value: '64',
        },
        {
          key: 'Memory (GiB)',
          value: '512',
        },
      ],
    },
  ].map((config) => ({ ...config, id: `${idCounter++}` }));
}

function registerContextItems(appContext) {
  appContext.environmentConfigurationsStore = EnvironmentConfigurationsStore.create({}, appContext);
}

export { EnvironmentConfigurationsStore, registerContextItems };
