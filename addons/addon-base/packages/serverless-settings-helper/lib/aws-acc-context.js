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
