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
