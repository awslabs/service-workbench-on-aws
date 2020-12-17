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

const states = {
  pending: {
    id: 'pending',
    display: 'Pending',
    color: 'orange',
  },
  error: {
    id: 'error',
    display: 'Unreachable',
    color: 'red',
  },
  reachable: {
    id: 'reachable',
    display: 'Available',
    color: 'green',
  },
};

// ==================================================================
// DataSourceStudy
// ==================================================================
const DataSourceStudy = types
  .model('DataSourceStudy', {
    id: '',
    rev: types.maybe(types.number),
    name: '',
    folder: '',
    accountId: '',
    awsPartition: 'aws',
    bucket: '',
    accessType: '',
    bucketAccess: '',
    qualifier: '',
    appRoleArn: '',
    category: '',
    region: '',
    kmsScope: '',
    kmsArn: '',
    status: '',
    statusMsg: '',
    statusAt: '',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    permissions: types.maybe(types.frozen()),
  })
  .actions(self => ({
    setStudy(raw = {}) {
      _.forEach(raw, (value, key) => {
        if (value === 'permissions') return; // we don't want to update the permissions
        if (_.isArray(value)) {
          self[key].replace(value);
        } else {
          self[key] = value;
        }
      });
    },

    setPermissions(permissions = {}) {
      self.permissions = permissions;
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get friendlyAccessType() {
      if (self.accessType === 'readonly') return 'Read Only';
      if (self.accessType === 'writeonly') return 'Write Only';
      return 'Read & Write';
    },

    get state() {
      return states[self.status] || states.reachable;
    },
  }));

export { DataSourceStudy }; // eslint-disable-line import/prefer-default-export
