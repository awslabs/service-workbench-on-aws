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
import { types, applySnapshot, getEnv } from 'mobx-state-tree';

const KeyValuePair = types.model('KeyValuePair', {
  key: '',
  value: '',
});

// ====================================================================================================================================
// EnvTypeConfig
// ====================================================================================================================================
const EnvTypeConfig = types
  .model('EnvTypeConfig', {
    id: types.identifier,
    name: '',
    desc: '',
    estimatedCostInfo: '',
    allowRoleIds: types.optional(types.array(types.string), []),
    denyRoleIds: types.optional(types.array(types.string), []),
    params: types.optional(types.array(KeyValuePair), []),
    tags: types.optional(types.array(KeyValuePair), []),
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',

    // flag indicating if the env type config is allowed to be used
    // defaulting this to true as the API only returns those env type configs that are usable
    // except for admins when include=all is passed in the query param, it returns all env type configs
    // including the ones the user is not allowed to use when launching an environment
    allowedToUse: types.optional(types.boolean, true),
  })
  .actions(self => ({
    setEnvTypeConfig(envTypeConfig) {
      applySnapshot(self, envTypeConfig);
    },
  }))
  .views(self => ({
    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc);
    },
    get estimatedCostInfoHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.estimatedCostInfo);
    },
    get instanceType() {
      const params = self.params;
      // Make a array of arrays out of the params elements
      // Each sub-array is a key-value pair for each parameter
      const configParams = Object.entries(params);

      // find the index of the parameter whose key is InstanceType or MasterInstanceType (for EMR)
      // param[1] gets the object with the useful parameter information
      // Object.entries(param[1]) makes the useful information ennumerable in an array
      // Object.entries(param[1])[0] gets a key-value pair where key = "key" and value = the key name for that parameter
      // Object.entries(param[1])[0][1] gets the name of the parameter
      const instanceTypeElement = _.findIndex(configParams, param => {
        const key = Object.entries(param[1])[0][1];
        return key === 'InstanceType' || key === 'MasterInstanceType';
      });
      let instanceType;
      if (instanceTypeElement >= 0) {
        // the second [1] gets the key-value pair where key = "value" and value = the instance type string
        instanceType = Object.entries(configParams[instanceTypeElement][1])[1][1];
      } else {
        // If no instance type param found
        instanceType = 'Not available';
      }

      return instanceType;
    },
  }));

export default EnvTypeConfig;
export { EnvTypeConfig };
