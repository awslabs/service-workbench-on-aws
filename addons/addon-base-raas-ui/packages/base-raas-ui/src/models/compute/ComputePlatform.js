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
import { values } from 'mobx';
import { types, getEnv, applySnapshot } from 'mobx-state-tree';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { ComputeConfiguration } from './ComputeConfiguration';

// This represents a compute platform information such as an emr or an ec2
const ComputePlatform = types
  .model('ComputePlatform', {
    id: types.identifier,
    type: '',
    title: '',
    desc: '',
    displayOrder: types.maybe(types.number),
    configurations: types.map(ComputeConfiguration),
  })
  .actions(self => ({
    setComputePlatform(rawComputePlatform) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic

      // Preserve configurations
      const configurations = self.configurations || {};
      applySnapshot(self, rawComputePlatform);
      self.configurations = configurations;
    },

    setConfigurations(raw) {
      consolidateToMap(self.configurations, raw, (exiting, newItem) => {
        exiting.setComputeConfiguration(newItem);
      });
    },
  }))
  .views(self => ({
    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc);
    },

    get configurationsList() {
      return _.sortBy(values(self.configurations), 'displayOrder');
    },

    getConfiguration(configurationId) {
      return self.configurations.get(configurationId);
    },
  }));

export { ComputePlatform };
