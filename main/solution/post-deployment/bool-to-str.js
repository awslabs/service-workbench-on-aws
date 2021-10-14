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
// Adapted from: https://stackoverflow.com/questions/65832576/converting-ssm-value-to-number

// To convert a boolean value to a string to be used by the serverless framework

module.exports = async serverless => {
  // Get params details from serverless.yml
  // eslint-disable-next-line global-require
  const settings = await require('./config/settings/.settings').merged(serverless);
  const enableEgressStore = settings.enableEgressStore;

  // Must be explicitly equal to true and not just a "truthy" value
  return enableEgressStore === true ? 'true' : 'false';
};
