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
    qualifier: '',
    contactInfo: '',
    stack: '',
    status: '',
    statusMsg: '',
    statusAt: '',
    description: '',
    type: '', // managed vs unmanaged
    buckets: types.array(types.frozen()),
    studies: types.map(DataSourceStudy),
  })
  .actions(self => ({
    setDataSourceAccount(raw = {}) {
      _.forEach(raw, (value, key) => {
        if (value === 'studies') return; // we don't want to update the studies
        self[key] = value;
      });
    },

    setStudies(studies) {
      consolidateToMap(self.studies, studies, (exiting, newItem) => {
        exiting.setStudy(newItem);
      });
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get studiesList() {
      return _.orderBy(values(self.studies), ['name', 'createdAt'], ['desc', 'asc']);
    },

    getStudy(studyId) {
      return self.studies.get(studyId);
    },
  }));

export { DataSourceAccount }; // eslint-disable-line import/prefer-default-export
