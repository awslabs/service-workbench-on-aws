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
    contactInfo: types.optional(types.maybeNull(types.string), ''),
    stack: '',
    status: '',
    statusMsg: '',
    statusAt: '',
    description: types.optional(types.maybeNull(types.string), ''),
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

    get bucketNames() {
      return _.map(self.buckets, bucket => bucket.name);
    },

    getStudiesForBucket(name) {
      return _.filter(values(self.studies), study => study.bucket === name);
    },

    get emailCommonSection() {
      const names = self.bucketNames;
      const lines = ['Dear Admin,', '', 'We are requesting access to the following bucket(s) and studies:'];
      _.forEach(names, name => {
        lines.push(`\nBucket name: ${name}`);
        const studies = self.getStudiesForBucket(name);
        _.forEach(studies, study => {
          lines.push(` - folder: ${study.folder}`);
          lines.push(`   access: ${study.friendlyAccessType}`);
        });
      });

      lines.push('');
      lines.push(
        'For your convenience, you can follow these steps to configure the account for the requested access:\n',
      );

      return lines;
    },

    get updateStackEmailTemplate() {
      const { id, mainRegion, stackInfo = {} } = self;
      const { cfnConsoleUrl, updateStackUrl, urlExpiry } = stackInfo;
      const lines = _.slice(self.emailCommonSection);

      lines.push(
        `1 - Log in to the aws console using the correct account. Please ensure that you are using the correct account # ${id} and region ${mainRegion}\n`,
      );
      lines.push(`2 - Go to the AWS CloudFormation console ${cfnConsoleUrl}\n`);
      lines.push(`    You need to visit the AWS CloudFormation console page before you can follow the next link\n`);
      lines.push(`3 - Click on the following link\n`);
      lines.push(`    ${updateStackUrl}\n`);
      lines.push(
        '    The link takes you to the CloudFormation console where you can review the stack information and provision it.\n',
      );
      lines.push(`    Note: the link expires at ${new Date(urlExpiry).toISOString()}`);
      lines.push(`\n\nRegards,\nService Workbench admin`);
      return lines.join('\n');
    },

    get createStackEmailTemplate() {
      const { id, mainRegion, stackInfo = {} } = self;
      const { createStackUrl, urlExpiry } = stackInfo;
      const lines = _.slice(self.emailCommonSection);

      lines.push(
        `1 - Log in to the aws console using the correct account. Please ensure that you are using the correct account # ${id} and region ${mainRegion}\n`,
      );
      lines.push(`2 - Click on the following link\n`);
      lines.push(`    ${createStackUrl}\n`);
      lines.push(
        '    The link takes you to the CloudFormation console where you can review the stack information and provision it.\n',
      );
      lines.push(`    Note: the link expires at ${new Date(urlExpiry).toISOString()}`);
      lines.push(`\n\nRegards,\nService Workbench admin`);
      return lines.join('\n');
    },
  }));

export { DataSourceAccount }; // eslint-disable-line import/prefer-default-export
