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
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';
import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';

import { getStudies, createStudy } from '../../helpers/api';
import { categories } from './categories';
import { Study } from './Study';
import { StudyStore } from './StudyStore';

// ==================================================================
// StudiesStore
// ==================================================================
const StudiesStore = BaseStore.named('StudiesStore')
  .props({
    category: '',
    studies: types.optional(types.map(Study), {}),
    studyStores: types.optional(types.map(StudyStore), {}),
    tickPeriod: 300 * 1000, // 5 minutes
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const studies = await getStudies(self.category);
        // We try to preserve existing studies data and merge the new data instead
        // We could have used self.studies.replace(), but it will do clear() then merge()
        self.runInAction(() => {
          consolidateToMap(self.studies, studies, (exiting, newItem) => {
            exiting.setStudy(newItem);
          });
        });
      },

      addStudy(rawStudy) {
        const id = rawStudy.id;
        const previous = self.studies.get(id);

        if (!previous) {
          self.studies.put(rawStudy);
        } else {
          previous.setStudy(rawStudy);
        }
      },

      getStudyStore: studyId => {
        let entry = self.studyStores.get(studyId);
        if (!entry) {
          // Lazily create the store
          self.studyStores.set(studyId, StudyStore.create({ studyId }));
          entry = self.studyStores.get(studyId);
        }

        return entry;
      },

      async createStudy(study) {
        const result = await createStudy({ ...study, uploadLocationEnabled: true });
        self.runInAction(() => {
          self.addStudy(result);
        });
        const resultStudy = self.getStudy(result.id);

        return resultStudy;
      },

      cleanup: () => {
        self.studies.clear();
        self.studyStores.clear();
        superCleanup();
      },
    };
  })

  .views(self => ({
    get empty() {
      return self.studies.size === 0;
    },

    get total() {
      return self.studies.size;
    },

    get list() {
      const result = [];
      self.studies.forEach(study => result.push(study));

      return _.reverse(_.sortBy(result, ['createdAt', 'name']));
    },

    hasStudy(id) {
      return self.studies.has(id);
    },

    getStudy(id) {
      return self.studies.get(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.studiesStoresMap = {
    // TODO - we should be using ids when calling the backend but the backend needs fixing too since it does not support ids yet
    [categories.myStudies.id]: StudiesStore.create({ category: categories.myStudies.name }),
    [categories.organization.id]: StudiesStore.create({ category: categories.organization.name }),
    [categories.openData.id]: StudiesStore.create({ category: categories.openData.name }),
  };

  appContext.cleanupMap = {
    // This method is going to be automatically called when the logout is invoked
    cleanup: () => {
      _.forEach(appContext.studiesStoresMap, obj => {
        if (_.isFunction(obj.cleanup)) {
          try {
            obj.cleanup();
          } catch (error) {
            console.error(error);
          }
        }
      });
    },
  };
}

export { registerContextItems };
