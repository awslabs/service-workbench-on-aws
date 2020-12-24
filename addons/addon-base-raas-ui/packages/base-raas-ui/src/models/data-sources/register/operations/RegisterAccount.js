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

import { isAlreadyExists } from '../../../../helpers/errors';
import Operation from '../../../operations/Operation';

class RegisterAccountOperation extends Operation {
  constructor({ account = {}, accountsStore }) {
    super();
    const { id } = account;
    this.account = account;
    this.name = `Registering account #${id}`;
    this.accountsStore = accountsStore;
  }

  async doRun() {
    const { id } = this.account;
    this.setMessage(`Registering AWS account #${id}`);
    try {
      await this.accountsStore.registerAccount(this.account);
      this.setMessage(`Successfully registered account #${id}`);
    } catch (error) {
      // Check if the error is about existing account, if so, then skip it
      if (!isAlreadyExists(error)) throw error;

      this.markSkipped();
      this.setMessage(`Skipping account registration, the account is already registered`);
    }
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(RegisterAccountOperation, {
  doRun: action,
});

export default RegisterAccountOperation;
