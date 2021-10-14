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
const _ = require('lodash');

async function getCFStackResources() {
  // eslint-disable-next-line no-undef
  const { hostingAccountStackName } = getSettings();
  const cloudformation = new AWS.CloudFormation();
  return cloudformation
    .describeStackResources({
      StackName: hostingAccountStackName,
    })
    .promise();
}

async function getStackResourcesByType(resourceType, stackResources = {}) {
  let resources = { ...stackResources };
  if (_.isEmpty(resources)) {
    resources = await getCFStackResources();
  }

  return resources.StackResources.filter(resource => {
    return resource.ResourceType === resourceType;
  }).map(sgResource => {
    return sgResource.PhysicalResourceId;
  });
}

function getSettings() {
  // eslint-disable-next-line no-undef
  const { awsProfile, awsRegion, envName, externalId } = __settings__;
  // eslint-disable-next-line no-undef
  let { hostingAccountId, hostingAccountStackName } = __settings__;

  if (hostingAccountId === undefined) {
    hostingAccountId = process.env.INFRA_TESTS_HOSTING_ACCOUNT_ID;
  }
  if (hostingAccountStackName === undefined) {
    hostingAccountStackName = process.env.INFRA_TESTS_HOSTING_ACCOUNT_STACK_NAME;
  }

  return { awsProfile, awsRegion, envName, externalId, hostingAccountId, hostingAccountStackName };
}

module.exports = {
  getSettings,
  getCFStackResources,
  getStackResourcesByType,
};
