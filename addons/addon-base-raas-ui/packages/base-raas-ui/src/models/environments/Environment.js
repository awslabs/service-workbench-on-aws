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
import { uiEventBus } from '@aws-ee/base-ui/dist/models/SessionStore';
import { storage } from '@aws-ee/base-ui/dist/helpers/utils';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

import { InstanceInfo } from './InstanceInfo';
import { getEnvironmentKeypair, getEnvironmentNotebookUrl, getEnvironmentPasswordData } from '../../helpers/api';
import SageMakerService from '../../helpers/sage-maker-service';
import localStorageKeys from '../constants/local-storage-keys';

// ==================================================================
// Environment
// ==================================================================
const serviceCost = types.model({
  amount: types.number,
  unit: types.string,
});

const environmentCost = types.model({
  startDate: types.string,
  cost: types.map(serviceCost),
});

const Environment = types
  .model('Environment', {
    id: types.identifier,
    rev: types.maybe(types.number),
    description: '',
    instanceInfo: types.optional(InstanceInfo, {}),
    name: '',
    status: '',
    indexId: '',
    projectId: '',
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),
    costs: types.optional(types.array(environmentCost), []),
    fetchingUrl: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
    isExternal: types.optional(types.boolean, false),
    stackId: types.maybeNull(types.string),
    sharedWithUsers: types.array(UserIdentifier, []),
  })
  .actions((self) => ({
    setEnvironment(rawEnvironment) {
      // Note: if you have partial data vs full data, you need to replace the applySnapshot() with
      // the appropriate logic

      // Preserve the value of the fetchingUrl
      const fetchingUrl = self.fetchingUrl;
      applySnapshot(self, rawEnvironment);
      self.fetchingUrl = fetchingUrl;
    },

    async getEnvironmentNotebookUrl(user) {
      if (self.isExternal) {
        if (!_.isEmpty(storage.getItem(localStorageKeys.pinToken))) {
          const creds = await user.unencryptedCreds(storage.getItem(localStorageKeys.pinToken));
          const sm = new SageMakerService(creds.accessKeyId, creds.secretAccessKey, creds.region);
          return sm.getPresignedNotebookInstanceUrl(self.instanceInfo.NotebookInstanceName);
        }
        throw new Error('No PIN to decrypt User credientials');
      } else {
        self.setFetchingUrl(true);
        return getEnvironmentNotebookUrl(self.id);
      }
    },

    setFetchingUrl(value) {
      self.fetchingUrl = value;
    },

    markAsTerminating() {
      self.status = 'TERMINATING';
    },

    async getKeyPair() {
      return getEnvironmentKeypair(self.id, `${self.id}.pem`);
    },

    async getWindowsPassword() {
      return Promise.all([self.getKeyPair(), getEnvironmentPasswordData(self.id)]);
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views((self) => ({
    // add view methods here
    get isTerminated() {
      return _.includes(['TERMINATING', 'TERMINATED', 'TERMINATING_FAILED'], this.status);
    },

    get isCompleted() {
      return _.includes(['COMPLETED'], this.status);
    },

    get isPending() {
      return _.includes(['PENDING'], this.status);
    },

    get isError() {
      return _.includes(['FAILED'], this.status);
    },
  }));

// eslint-disable-next-line no-unused-vars
function registerContextItems(appContext) {
  uiEventBus.listenTo('environmentDeleted', {
    id: 'Environment',
    listener: async (event) => {
      // event will be the environment object
      event.markAsTerminating();
    },
  });
}

export { Environment, registerContextItems };
