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
import { types, applySnapshot } from 'mobx-state-tree';

// TODO: Improve file model
// const File2 = types.model('File2', {
//   name: '',
//   size: types.optional(types.number, 0),
// });

// TODO this should have been named 'Run'
const File = types.model('File', {
  id: types.identifier,
  name: '',
  description: types.maybeNull(types.string),
  accessStatus: '',
});

// TODO this should have been named 'RunsSelection'
const FilesSelection = types
  .model('FilesSelection', {
    files: types.optional(types.map(File), {}),
  })
  .actions(self => ({
    setFile(file) {
      self.files.set(file.id, file);
    },
    deleteFile(id) {
      self.files.delete(id);
    },
    cleanup() {
      self.files.clear();
    },
    setFiles(filesMapSnapshot) {
      applySnapshot(self.files, filesMapSnapshot);
    },
  }))
  .views(self => ({
    hasFile(id) {
      return self.files.has(id);
    },
    get empty() {
      return self.files.size === 0;
    },
    get count() {
      return self.files.size;
    },
    get studiesCount() {
      const studyIdMap = {};
      self.files.forEach(entry => {
        studyIdMap[entry.studyId] = true;
      });

      return _.size(studyIdMap);
    },
    studiesCountByStatus: state => {
      const studyIdMap = {};
      self.files.forEach(entry => {
        if (entry.accessStatus === state) studyIdMap[entry.studyId] = true;
      });

      return _.size(studyIdMap);
    },
    studiesCountByNotStatus: state => {
      const studyIdMap = {};
      self.files.forEach(entry => {
        if (entry.accessStatus !== state) studyIdMap[entry.studyId] = true;
      });

      return _.size(studyIdMap);
    },
    get fileNames() {
      const names = [];
      self.files.forEach(entry => {
        names.push(entry.id);
      });

      return names;
    },
    groupByStudy: () => {
      const studyIdMap = {};
      self.files.forEach(entry => {
        const values = studyIdMap[entry.studyId];
        if (_.isArray(values)) {
          values.push(entry);
        } else {
          studyIdMap[entry.studyId] = [entry];
        }
      });

      return studyIdMap;
    },
    groupNotApprovedByStudy: () => {
      const studyIdMap = {};
      self.files.forEach(entry => {
        if (entry.accessStatus === 'approved') return;
        const values = studyIdMap[entry.studyId];
        if (_.isArray(values)) {
          values.push(entry);
        } else {
          studyIdMap[entry.studyId] = [entry];
        }
      });

      return studyIdMap;
    },
    countByStatus: state => {
      let counter = 0;
      self.files.forEach(file => {
        if (file.accessStatus === state) counter += 1;
      });

      return counter;
    },
  }));

function registerContextItems(appContext) {
  appContext.filesSelection = FilesSelection.create({}, appContext);
}

export { FilesSelection, registerContextItems };
