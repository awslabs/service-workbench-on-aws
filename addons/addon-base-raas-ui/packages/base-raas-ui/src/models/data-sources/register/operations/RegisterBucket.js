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

class RegisterBucketOperation extends Operation {
  constructor({ accountId, bucket = {}, accountsStore }) {
    super();
    this.accountId = accountId;
    this.bucket = bucket;
    this.name = `Registering bucket ${bucket.name}`;
    this.accountsStore = accountsStore;
    if (this.bucket.kmsArn === '') {
      delete this.bucket.kmsArn;
    }
  }

  async doRun() {
    const { name } = this.bucket;
    this.setMessage(`Registering bucket ${name}`);
    try {
      await this.accountsStore.registerBucket(this.accountId, this.bucket);
      this.setMessage(`Successfully registered bucket ${name}`);
    } catch (error) {
      // Check if the error is about existing bucket, if so, then skip it
      if (!isAlreadyExists(error)) throw error;

      this.markSkipped();
      this.setMessage(`Skipping bucket registration, the bucket is already registered`);
    }
  }
}

// see https://medium.com/@mweststrate/mobx-4-better-simpler-faster-smaller-c1fbc08008da
decorate(RegisterBucketOperation, {
  doRun: action,
});

export default RegisterBucketOperation;
