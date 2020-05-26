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

const StepBase = require('@aws-ee/base-workflow-core/lib/workflow/helpers/step-base');

class ReleaseWriteLock extends StepBase {
  async start() {
    const tokenKeyName = await this.config.string('writeTokenKeyName');
    const writeToken = await this.payload.optionalString(tokenKeyName);
    const lockService = await this.mustFindServices('lockService');

    if (writeToken) {
      await lockService.releaseWriteLock({ writeToken });
      await this.payload.removeKey(tokenKeyName);
      await this.statusMessage(`Released write token "${writeToken}"`);
    } else {
      this.statusMessage('WARN|||No write token is found in the payload, therefore, no write lock to release');
    }
  }

  async inputKeys() {
    const keys = {
      writeTokenKeyName: 'string',
    };
    const tokenKeyName = await this.config.string('writeTokenKeyName');
    keys[tokenKeyName] = 'optionalString';
    return keys;
  }
}

module.exports = ReleaseWriteLock;
