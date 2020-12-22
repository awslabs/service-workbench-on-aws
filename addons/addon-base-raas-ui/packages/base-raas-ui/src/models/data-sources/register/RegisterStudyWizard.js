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
import { types, getEnv } from 'mobx-state-tree';

import Operations from '../../operations/Operations';
import RegisterAccountOperation from './operations/RegisterAccount';

// ==================================================================
// RegisterStudyWizard
// ==================================================================
const RegisterStudyWizard = types
  .model('RegisterStudyWizard', {
    step: '',
  })

  .volatile(_self => ({
    operations: undefined,
  }))

  .actions(() => ({
    // I had issues using runInAction from mobx
    // the issue is discussed here https://github.com/mobxjs/mobx-state-tree/issues/915
    runInAction(fn) {
      return fn();
    },
  }))

  .actions(self => ({
    afterCreate: () => {
      self.step = 'input';
      self.operations = new Operations();
    },

    submit: async (formData = {}) => {
      const providedAccount = formData.account || {};
      const ops = self.operations;
      const accountsStore = self.accountsStore;
      const existingAccount = self.getAccount(providedAccount.id);

      ops.clear();

      if (!_.isEmpty(existingAccount)) {
        ops.add(new RegisterAccountOperation({ account: providedAccount, accountsStore }));
      }

      self.step = 'submit';
      await ops.run();
    },

    retry: async () => {
      self.step = 'submit';
      await self.operations.rerun();
    },

    reset: () => {
      self.cleanup();
    },

    cleanup: () => {
      self.step = 'input';
      if (self.operations) self.operations.clear();
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get isInputStep() {
      return self.step === 'input';
    },

    get isSubmitStep() {
      return self.step === 'submit';
    },

    get dropdownAccountOptions() {
      const accountsStore = getEnv(self).dataSourceAccountsStore;

      return accountsStore.dropdownOptions;
    },

    get accountsStore() {
      return getEnv(self).dataSourceAccountsStore;
    },

    getAccount(id) {
      return self.accountsStore.getAccount(id);
    },
  }));

function registerContextItems(appContext) {
  appContext.registerStudyWizard = RegisterStudyWizard.create({}, appContext);
}

export { RegisterStudyWizard, registerContextItems };
