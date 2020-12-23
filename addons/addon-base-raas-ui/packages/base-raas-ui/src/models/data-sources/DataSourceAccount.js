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
import { values } from 'mobx';
import { types } from 'mobx-state-tree';

import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { DataSourceStudy } from './DataSourceStudy';
import { StackInfo } from './StackInfo';

const states = {
  pending: {
    id: 'pending',
    display: 'Pending',
    color: 'orange',
  },
  error: {
    id: 'error',
    display: 'Unavailable',
    color: 'red',
  },
  reachable: {
    id: 'reachable',
    display: 'Available',
    color: 'green',
  },
};

// ==================================================================
// DataSourceAccount
// ==================================================================
const DataSourceAccount = types
  .model('DataSourceAccount', {
    id: '',
    rev: types.maybe(types.number),
    name: '',
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: '',
    stackCreated: false,
    mainRegion: '',
    qualifier: '',
    contactInfo: '',
    stack: '',
    status: '',
    statusMsg: '',
    statusAt: '',
    description: '',
    type: '', // managed vs unmanaged
    templateIdExpected: '',
    templateIdFound: '',
    stackId: '',
    buckets: types.array(types.frozen()),
    studies: types.map(DataSourceStudy),
    stackInfo: types.optional(StackInfo, {}),
  })
  .actions(self => ({
    setDataSourceAccount(raw = {}) {
      _.forEach(raw, (value, key) => {
        if (value === 'studies') return; // we don't want to update the studies
        if (value === 'stackInfo') return; // we don't want to update the stack info
        self[key] = value;
      });

      // We want to take care of thee statusMsg because it might come as undefined
      if (_.isUndefined(raw.statusMsg)) self.statusMsg = '';
    },

    setStudies(studies) {
      consolidateToMap(self.studies, studies, (existing, newItem) => {
        existing.setStudy(newItem);
      });
    },

    setStudy(study) {
      self.studies.set(study.id, study);

      return self.studies.get(study.id);
    },

    setBucket(bucket) {
      // Because buckets are frozen, we need to deep clone first
      const buckets = _.cloneDeep(self.buckets);
      buckets.push(bucket);
      self.buckets = buckets;

      return bucket;
    },

    setStackInfo(stackInfo) {
      self.stackInfo.setStackInfo(stackInfo);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get studiesList() {
      return _.orderBy(values(self.studies), ['id'], ['asc']);
    },

    getStudy(studyId) {
      return self.studies.get(studyId);
    },

    get state() {
      return states[self.status] || states.reachable;
    },

    get pendingState() {
      return self.status === 'pending';
    },

    get errorState() {
      return self.status === 'error';
    },

    get reachableState() {
      return self.status === 'reachable';
    },

    get statusMessageInfo() {
      const msg = self.statusMsg;
      const info = {
        prefix: '',
        color: 'grey',
        message: msg,
      };

      if (_.isEmpty(msg)) return info;

      if (_.startsWith(msg, 'WARN|||')) {
        info.prefix = 'WARN';
        info.message = _.nth(_.split(msg, '|||'), 1);
        info.color = 'orange';
      } else if (_.startsWith(msg, 'ERR|||')) {
        info.prefix = 'ERR';
        info.message = _.nth(_.split(msg, '|||'), 1);
        info.color = 'red';
      }

      return info;
    },

    get stackOutDated() {
      return !_.isEmpty(self.stackId) && self.stackCreated && self.templateIdExpected !== self.templateIdFound;
    },

    get incorrectStackNameProvisioned() {
      return _.isEmpty(self.stackId) && self.stackCreated;
    },

    getBucket(name) {
      return _.find(self.buckets, bucket => bucket.name === name);
    },
  }));

export { DataSourceAccount }; // eslint-disable-line import/prefer-default-export
