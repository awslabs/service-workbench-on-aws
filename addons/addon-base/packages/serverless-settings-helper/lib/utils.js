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

const aws = require('aws-sdk');

/**
 * A utility function to construct AWS SDK client for various services.
 * The function configures various options and optionally loads credentials
 * based on aws credentials profile. If no profile is specified then it
 * constructs the client without explicitly specified profile to allow the
 * client to credentials from the default credentials chain
 *
 * @param whichClient
 * @param awsProfile
 * @param options
 */
function createAwsSdkClient(whichClient, awsProfile, options = {}) {
  options.maxRetries = options.maxRetries || 3;
  options.sslEnabled = true;

  // if a an AWS SDK profile has been configured, use its credentials
  if (awsProfile) {
    const credentials = new aws.SharedIniFileCredentials({ profile: awsProfile });
    options.credentials = credentials;
  }
  return new aws[whichClient](options);
}
exports.createAwsSdkClient = createAwsSdkClient;
