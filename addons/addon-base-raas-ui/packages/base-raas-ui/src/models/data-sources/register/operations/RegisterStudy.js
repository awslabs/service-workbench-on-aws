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

import Operation from '../../../operations/Operation';

class RegisterStudyOperation extends Operation {
  constructor({ accountId, bucket = {}, study = {}, accountsStore }) {
    super();
    this.accountId = accountId;
    this.bucket = bucket;
    this.study = study;
    this.name = `Registering study ${study.name || study.id}`;
    this.accountsStore = accountsStore;
  }

  async doRun() {
    const study = this.study;
    this.setMessage(`Registering study ${study.name || study.id}`);
    await this.accountsStore.registerStudy(this.accountId, this.bucket.name, this.study);
    this.setMessage(`Successfully registered study ${study.name || study.id}`);
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(RegisterStudyOperation, {
  doRun: action,
});

export default RegisterStudyOperation;
