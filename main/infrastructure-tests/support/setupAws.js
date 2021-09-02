const AWS = require('aws-sdk');

async function setupAws() {
  // eslint-disable-next-line no-undef
  const { awsProfile, awsRegion, envName, externalId, hostingAccountId, hostingAccountStackName } = __settings__;
  AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: awsProfile });
  AWS.config.region = awsRegion;

  // Assume hosting account credentials
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
