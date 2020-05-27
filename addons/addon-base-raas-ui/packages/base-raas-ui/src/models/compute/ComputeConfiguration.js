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
import { types, getEnv, applySnapshot } from 'mobx-state-tree';

// This represents a specific configuration of a compute platform, such as a specific size of an ec2 setup
const ComputeConfiguration = types
  .model('ComputeConfiguration', {
    id: types.identifier,
    type: '',
    title: '',
    displayOrder: types.maybe(types.number),
    priceInfo: types.frozen(),
    desc: '',
    displayProps: types.frozen(), // an array of objects, each object has a key and a value that are purely used for displaying purposes
    params: types.frozen(),
  })
  .actions((self) => ({
    setComputeConfiguration(raw) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic
      applySnapshot(self, raw);
    },
  }))
  .views((self) => ({
    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc);
    },

    // Returns true if the configuration supports changing the value of a given param
    isMutable(param) {
      return _.has(self.params, ['mutable', param]);
    },

    // Returns all mutable parameters that this configuration allow
    get mutableParams() {
      return _.get(self.params, 'mutable', {});
    },

    // If undefined is returned, it means that changing the cidr value is not supported
    get defaultCidr() {
      if (!self.isMutable('cidr')) return undefined;
      return _.get(self.mutableParams, 'cidr', '');
    },

    get pricePerDay() {
      const info = self.priceInfo || {};
      if (info.timeUnit === 'hour') return info.value * 24;
      if (info.timeUnit === 'day') return info.value;

      return undefined;
    },

    // Use this method to get a value of a parameter, regardless whether it is immutable or not
    // We first see if the parameter exists in the immutable params if so, it is returned,
    // otherwise the one in the mutable params is returned if any
    getParam(name) {
      const value = _.get(self.params, ['immutable', name]);
      if (!_.isUndefined(value)) return value;
      return _.get(self.mutableParams, name);
    },
  }));

export { ComputeConfiguration };
