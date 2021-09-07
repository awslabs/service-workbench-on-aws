const AWS = require('aws-sdk');

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

async function getStackResourcesByType(resourceType) {
  const stackResources = await getCFStackResources();
  return stackResources.StackResources.filter(resource => {
    return resource.ResourceType === resourceType;
  }).map(sgResource => {
    return sgResource.PhysicalResourceId;
  });
}

module.exports = {
  getCFStackResources,
  getStackResourcesByType,
};
