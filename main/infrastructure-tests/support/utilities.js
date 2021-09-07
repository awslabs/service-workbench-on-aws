const AWS = require('aws-sdk');
const _ = require('lodash');

async function getCFStackResources() {
  // eslint-disable-next-line no-undef
  const { hostingAccountStackName } = __settings__;
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

module.exports = {
  getCFStackResources,
  getStackResourcesByType,
};
