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
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { listStudyFiles } from '../../helpers/api';

// ==================================================================
// StudyFile
// ==================================================================
const StudyFile = types.model('StudyFile', {
  filename: types.string,
  size: types.integer,
  lastModified: types.Date,
});

// ==================================================================
// StudyFiles
// ==================================================================
const StudyFilesStore = BaseStore.named('StudyFilesStore')
  .props({
    studyId: '',
    files: types.array(StudyFile),
    tickPeriod: 5 * 1000, // 5 seconds
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        // Retrieve files
        let files = await listStudyFiles(self.studyId);

        // Determine which files were added or removed
        const comparator = (fileA, fileB) => fileA.filename === fileB.filename;
        const removed = _.differenceWith(self.files, files, comparator);
        const added = _.differenceWith(files, self.files, comparator);

        // Only update store when needed to avoid unnecessary re-rendering
        if (removed.length !== 0 || added.length !== 0) {
          // Sort files by name and cast lastModified as Date()
          files = files
            .sort((fileA, fileB) => fileA.filename.localeCompare(fileB.filename))
            .map(file => ({
              ...file,
              lastModified: new Date(file.lastModified),
            }));

          // Update store
          self.runInAction(() => {
            self.files.replace(files);
          });
        }
      },

      cleanup: () => {
        self.files.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.files.length === 0;
    },
  }));

// Note: Do NOT register this in the global context, if you want to gain access to an instance
//       use study.getFilesStore()
export { StudyFilesStore }; // eslint-disable-line import/prefer-default-export
