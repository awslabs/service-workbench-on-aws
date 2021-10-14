/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const Service = require('@aws-ee/base-services-container/lib/service');
/**
 * Creation of Environment Type Configuration requires specifying mapping between AWS CloudFormation Input Parameters
 * and predefined values. Many times, the values are not available at the time of creating this mapping. In such cases,
 * a variable expression in the form of ${variableName} can be specified in place of the value.
 * The Environment Type Configuration Variables denote all such variables that can be referenced in the variable
 * expressions.
 *
 * This service provides list of AppStream Addon Specific Environment Type Configuration Variables
 */
class AppStreamScEnvConfigVarsService extends Service {
  constructor() {
    super();
    this.dependency(['environmentScService', 'indexesService', 'awsAccountsService']);
  }

  // eslint-disable-next-line no-unused-vars
  async list(requestContext) {
    return [
      {
        name: 'appStreamSecurityGroupId',
        desc:
          'Security Group ID of the AppStream Fleet. If this workspace needs to be streamed via AppStream then you need to allow inbound traffic to your workspace from this Security Group.',
      },
    ];
  }

  // eslint-disable-next-line no-unused-vars
  async resolveEnvConfigVars(requestContext, { envId }) {
    const [environmentScService, indexesService, awsAccountsService] = await this.service([
      'environmentScService',
      'indexesService',
      'awsAccountsService',
    ]);

    const environment = await environmentScService.mustFind(requestContext, { id: envId });

    const { indexId } = environment;

    // Get the aws account information
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });

    const { appStreamSecurityGroupId } = await awsAccountsService.mustFind(requestContext, { id: awsAccountId });

    return { appStreamSecurityGroupId };
  }
}
module.exports = AppStreamScEnvConfigVarsService;
