const STS = require('aws-sdk/clients/sts');

export default function getAccountDetails({ accessKeyId, secretAccessKey, region = 'us-east-1' }) {
  const sts = accessKeyId
    ? new STS({
        accessKeyId,
        secretAccessKey,
        region,
        sslEnabled: true,
      })
    : new STS({ sslEnabled: true });

  return sts.getCallerIdentity().promise();
}
