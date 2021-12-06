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
import { detach, types } from 'mobx-state-tree';

import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { consolidateToMap, mapToArray } from '@aws-ee/base-ui/dist/helpers/utils';
import { getAllEnvTypeCandidatesNotImported } from '../../helpers/api';
import { EnvTypeCandidate } from './EnvTypeCandidate';

// ==================================================================
// EnvTypeCandidatesStore
// ==================================================================
const EnvTypeCandidatesStore = BaseStore.named('EnvTypeCandidatesStore')
  .props({
    envTypeCandidates: types.optional(types.map(EnvTypeCandidate), {}),
    tickPeriod: 60 * 1000, // 1 minute
  })
  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const workTypeCandidateRes = (await getAllEnvTypeCandidatesNotImported()) || {};
        const envTypeCandidates = workTypeCandidateRes.list || [];
        self.portfolioId = workTypeCandidateRes.portfolioId || '';
        self.runInAction(() => {
          consolidateToMap(self.envTypeCandidates, envTypeCandidates, (exiting, newItem) => {
            exiting.setEnvTypeCandidate(newItem);
          });
        });
      },

      cleanup: () => {
        self.envTypeCandidates.clear();
        superCleanup();
      },

      async onEnvTypeCandidateImport(id) {
        // Addition or deletion of env type impacts env type candidates store
        // because imported env types are no longer candidates for import
        // reload env type candidates store as well
        const envTypeCandidateImported = self.envTypeCandidates.get(id);

        // The self.envTypeCandidatesStore.load() will result in envTypeCandidateImported being deleted from the map (i.e., deleted from the tree)
        // at this point if we are on any view that is referencing envTypeCandidateImported we will get
        // "You are trying to read or write to an object that is no longer part of a state tree" mobx-state-tree error
        // to avoid this, detach the node first
        detach(envTypeCandidateImported);

        await self.load();
      },
    };
  })
  .views(self => ({
    get list() {
      return _.sortBy(mapToArray(self.envTypeCandidates), c => -1 * _.get(c, 'provisioningArtifact.createdTime'));
      // return [];
    },
    get listLatestVersions() {
      return _.filter(self.list, 'isLatest');
    },
    get listAllVersions() {
      return self.list;
    },
    get empty() {
      return _.isEmpty(self.list);
    },
    getEnvTypeCandidate(id) {
      return self.envTypeCandidates.get(id);
    },
  }));
function registerContextItems(appContext) {
  appContext.envTypeCandidatesStore = EnvTypeCandidatesStore.create({}, appContext);
}

export { EnvTypeCandidatesStore, registerContextItems };
