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
const { processInBatches } = require('@aws-ee/base-services/lib/helpers/utils');

class BulkReachabilityCheck extends StepBase {
  async start() {
    this.print('start pinging data source accounts');

    // Get services
    const dataSourceReachabilityService = await this.mustFindServices('dataSourceReachabilityService');

    // Get common payload params and pull environment info
    const requestContext = await this.payload.object('requestContext');
    // If you specify an id, you can’t specify a status filter
    const forceCheckAll = await this.payload.boolean('forceCheckAll');
    const dsAccountIds = await this.payload.object('dsAccountIds');

    const processor = async dsAccountId => {
      await dataSourceReachabilityService.attemptReach(
        requestContext,
        { id: dsAccountId, type: 'dsAccount' },
        { forceCheckAll },
      );
    };

    // For each dsAccount, reach out 10 at a time
    await processInBatches(dsAccountIds, 10, processor);
  }
}

module.exports = BulkReachabilityCheck;
