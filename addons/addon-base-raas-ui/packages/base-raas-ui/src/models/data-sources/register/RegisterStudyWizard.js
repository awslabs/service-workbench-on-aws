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
import RegisterBucketOperation from './operations/RegisterBucket';
import RegisterStudyOperation from './operations/RegisterStudy';
import PrepareCfnOperation from './operations/PrepareCfn';

// ==================================================================
// RegisterStudyWizard
// ==================================================================
const RegisterStudyWizard = types
  .model('RegisterStudyWizard', {
    step: '',
    accountId: '',
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
      self.step = 'start';
      self.operations = new Operations();
    },

    submit: async (formData = {}) => {
      const providedAccount = formData.account || {};
      const providedBucket = formData.bucket || {};
      const studies = formData.studies || [];
      const ops = self.operations;
      const accountsStore = self.accountsStore;
      const existingAccount = self.getAccount(providedAccount.id);
      const existingBucket = existingAccount ? existingAccount.getBucket(providedBucket.name) : undefined;

      self.accountId = providedAccount.id;
      ops.clear();

      if (_.isEmpty(existingAccount)) {
        ops.add(new RegisterAccountOperation({ account: providedAccount, accountsStore }));
      }

      if (_.isEmpty(existingBucket)) {
        ops.add(new RegisterBucketOperation({ accountId: providedAccount.id, bucket: providedBucket, accountsStore }));
      }

      _.forEach(studies, providedStudy => {
        const study = { ...providedStudy };
        // lets determine the kmsScope
        const sse = providedBucket.sse;
        const kmsArn = study.kmsArn;
        if (!_.isEmpty(kmsArn)) study.kmsScope = 'study';
        else if (sse === 'kms') study.kmsScope = 'bucket';
        else study.kmsScope = 'none';

        // make sure adminUsers is an array, this is because in the form drop down if the study is my studies, then
        // we ask for a single value, which will not return an array
        if (!_.isArray(study.adminUsers)) {
          study.adminUsers = [study.adminUsers];
        }

        ops.add(
          new RegisterStudyOperation({
            accountId: providedAccount.id,
            bucket: providedBucket,
            study: removeEmpty(study),
            accountsStore,
          }),
        );
      });

      ops.add(new PrepareCfnOperation({ accountId: providedAccount.id, accountsStore }));

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

    advanceToNextStep: () => {
      if (self.step === 'start') {
        self.step = 'input';
      } else if (self.step === 'submit') {
        self.step = 'cfn';
      }
    },

    cleanup: () => {
      self.step = 'start';
      if (self.operations) self.operations.clear();
      self.accountId = '';
    },
  }))

  // eslint-disable-next-line no-unused-vars
  .views(self => ({
    get isStartStep() {
      return self.step === 'start';
    },

    get isInputStep() {
      return self.step === 'input';
    },

    get isSubmitStep() {
      return self.step === 'submit';
    },

    get isCfnStep() {
      return self.step === 'cfn';
    },

    get dropdownAccountOptions() {
      const accountsStore = getEnv(self).dataSourceAccountsStore;

      return accountsStore.dropdownOptions;
    },

    get processedAccount() {
      if (_.isEmpty(self.accountId)) return {};

      return self.getAccount(self.accountId);
    },

    get accountsStore() {
      return getEnv(self).dataSourceAccountsStore;
    },

    getAccount(id) {
      return self.accountsStore.getAccount(id);
    },

    getBucket({ accountId, bucketName }) {
      const account = self.getAccount(accountId);
      if (_.isEmpty(account)) return undefined;

      return _.find(account.buckets, bucket => bucket.name === bucketName);
    },

    getBucketRegion({ accountId, bucketName }) {
      const bucket = self.getBucket({ accountId, bucketName });
      if (_.isEmpty(bucket)) return undefined;

      return bucket.region;
    },

    getDropdownBucketOptions(accountId) {
      const account = self.getAccount(accountId);
      if (_.isEmpty(account)) return [];

      return _.map(account.buckets, bucket => ({
        key: bucket.name,
        value: bucket.name,
        text: bucket.name,
      }));
    },
  }));

// Given an object returns a new object where all empty/undefined properties are removed
function removeEmpty(obj) {
  const result = {};
  _.forEach(_.keys(obj), key => {
    if (!_.isEmpty(obj[key])) {
      result[key] = obj[key];
    }
  });

  return result;
}

function registerContextItems(appContext) {
  appContext.registerStudyWizard = RegisterStudyWizard.create({}, appContext);
}

export { RegisterStudyWizard, registerContextItems };
