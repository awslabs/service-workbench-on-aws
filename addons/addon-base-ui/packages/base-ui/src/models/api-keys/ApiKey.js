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

import { types } from 'mobx-state-tree';
import _ from 'lodash';

const ApiKey = types
  .model('ApiKey', {
    id: types.identifier,
    ns: '',
    username: '',
    updatedAt: '',
    status: '',
    createdAt: '',
    expiryTime: 0,
    key: types.optional(types.string, ''),
  })
  .views((self) => ({
    get effectiveStatus() {
      if (self.status !== 'active') {
        // if status it not active then the effective status is same as status (such as "revoked")
        return self.status;
      }
      // if status is active then make sure it is not expired
      if (self.expiryTime > 0 && _.now() > self.expiryTime) {
        return 'expired';
      }
      return self.status;
    },
  }));

export default ApiKey;
