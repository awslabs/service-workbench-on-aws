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

const { createAwsSdkClient } = require('./utils');

/**
 * A function to return some context information about the AWS account being
 * accessed by the caller.
 *
 * @param awsProfile
 * @param awsRegion
 * @returns {Promise<{awsAccountId: *}>}
 */
async function getAwsAccountInfo(awsProfile, awsRegion) {
  const stsClient = createAwsSdkClient('STS', awsProfile, { apiVersion: '2011-06-15', region: awsRegion });
  const response = await stsClient.getCallerIdentity().promise();
  return {
    awsAccountId: response.Account,
  };
}
module.exports = { getAwsAccountInfo };
