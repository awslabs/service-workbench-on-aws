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

import { decorate, action } from 'mobx';

import { delay } from '@aws-ee/base-ui/dist/helpers/utils';

import { generateAccountCfnTemplate } from '../../../../helpers/api';
import Operation from '../../../operations/Operation';

class PrepareCfnOperation extends Operation {
  constructor({ accountId, accountsStore }) {
    super();
    this.accountId = accountId;
    this.name = `Preparing the latest CloudFormation for account #${accountId}`;
    this.accountsStore = accountsStore;
  }

  async doRun() {
    const accountsStore = this.accountsStore;
    const stackInfo = await generateAccountCfnTemplate(this.accountId);

    await delay(0.5); // We don't have strong read when we load the accounts, therefore we have this delay in place
    await accountsStore.load();

    const account = accountsStore.getAccount(this.accountId);
    account.setStackInfo(stackInfo);

    this.setMessage(`Successfully prepared CloudFormation for account #${this.accountId}`);
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(PrepareCfnOperation, {
  doRun: action,
});

export default PrepareCfnOperation;
