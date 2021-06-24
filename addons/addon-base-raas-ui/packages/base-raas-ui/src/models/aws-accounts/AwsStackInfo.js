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

// ==================================================================
// StackInfo
// ==================================================================
const AwsStackInfo = types
  .model('StackInfo', {
    id: '',
    name: '',
    region: '',
    accountId: '',
    stackId: '',
    template: types.optional(types.frozen(), {}),
    signedUrl: '',
    createStackUrl: '',
    updateStackUrl: '',
    cfnConsoleUrl: '',
    urlExpiry: 0,
  })
  .actions(self => ({
    setStackInfo(raw = {}) {
      _.forEach(raw, (value, key) => {
        self[key] = value;
      });
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get formattedTemplate() {
      // Unlike BYOB, the onboarding template is a YAML
      return self.template;
    },

    get hasUpdateStackUrl() {
      return !_.isEmpty(self.updateStackUrl);
    },

    get expired() {
      const now = Date.now();

      return self.urlExpiry < now + 1000 * 60; // lets buffer 1 minute
    },
  }));

export { AwsStackInfo }; // eslint-disable-line import/prefer-default-export
