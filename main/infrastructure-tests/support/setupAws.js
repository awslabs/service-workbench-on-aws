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
