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
const AWS = require('aws-sdk');
const { getSettings } = require('./utilities');
// Setup AWS SDK to assume credentials of hosting account
async function setupAws() {
  const { awsProfile, awsRegion, envName, externalId, hostingAccountId, hostingAccountStackName } = getSettings();
  // Get main account credentials
  // For github actions the AWS creds are provided through environment variables, for local dev environments it's provided through awsProfile
  if (awsProfile) {
    AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: awsProfile });
  }
  AWS.config.region = awsRegion;

  // Assume credentials of hosting account
  const sts = new AWS.STS({ apiVersion: '2011-06-15' });
  const roleArn = `arn:aws:iam::${hostingAccountId}:role/${hostingAccountStackName}-infrastructure-test-role`;
  const params = {
    RoleArn: roleArn,
    RoleSessionName: `${envName}-${Date.now()}`,
    ExternalId: externalId,
  };
  const { Credentials: credentials } = await sts.assumeRole(params).promise();

  AWS.config.update({
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken,
  });
}

module.exports = setupAws;
