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

import { generateAccountCfnTemplate } from '../../../../helpers/api';
import Operation from '../../../operations/Operation';

class PrepareCfnOperation extends Operation {
  constructor({ account = {}, accountsStore }) {
    super();
    this.account = account;
    this.name = `Preparing the latest CloudFormation for account #${account.id}`;
    this.accountsStore = accountsStore;
  }

  async doRun() {
    const stackInfo = await generateAccountCfnTemplate(this.account.id);
    const account = this.accountsStore.getAccount(this.account.id);
    account.setStackInfo(stackInfo);
    this.setMessage(`Successfully prepared CloudFormation for account #${this.account.id}`);
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(PrepareCfnOperation, {
  doRun: action,
});

export default PrepareCfnOperation;
