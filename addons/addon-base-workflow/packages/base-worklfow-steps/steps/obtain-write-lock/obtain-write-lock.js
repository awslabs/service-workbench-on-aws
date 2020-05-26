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

const _ = require('lodash');
const StepBase = require('@aws-ee/base-workflow-core/lib/workflow/helpers/step-base');

class ObtainLock extends StepBase {
  async start() {
    const attemptsCount = await this.config.number('attemptsCount');
    const waitPeriod = await this.config.number('waitPeriod');

    const obtained = await this.obtainToken();
    if (obtained) return undefined;

    return this.wait(waitPeriod).maxAttempts(attemptsCount).until('obtainToken');
  }

  async obtainToken() {
    const lockIdKeyName = await this.config.string('lockIdKeyName');
    const tokenKeyName = await this.config.string('writeTokenKeyName');
    const expiresIn = await this.config.number('expiresIn');
    const lockId = await this.payload.string(lockIdKeyName);
    const lockService = await this.mustFindServices('lockService');

    this.print(`Attempting to obtain a write lock for "${lockId}" with expiry value of "${expiresIn}"`);
    const writeToken = await lockService.obtainWriteLock({ id: lockId, expiresIn });
    if (_.isUndefined(writeToken)) return false;

    this.print(
      `successfully obtained a write lock for "${lockId}" with expiry value of "${expiresIn}" and writeToken "${writeToken}"`,
    );
    this.payload.setKey(tokenKeyName, writeToken);
    await this.statusMessage(`Obtained write token "${writeToken}"`);
    return true;
  }

  async inputKeys() {
    const keys = {
      lockIdKeyName: 'string',
      writeTokenKeyName: 'string',
      expiresIn: 'number',
    };
    const lockIdKeyName = await this.config.string('lockIdKeyName');
    keys[lockIdKeyName] = 'string';
    return keys;
  }

  async outputKeys() {
    const keys = {};
    const tokenKeyName = await this.config.string('writeTokenKeyName');
    keys[tokenKeyName] = 'string';
    return keys;
  }
}

module.exports = ObtainLock;
