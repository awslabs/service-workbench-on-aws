const Service = require('@aws-ee/base-services-container/lib/service');
const passwordGenerator = require('generate-password');

const settingKeys = {
  paramStoreJwtSecret: 'paramStoreJwtSecret',
  solutionName: 'solutionName',
};

class CreateJwtKeyService extends Service {
  constructor() {
    super();
    this.dependency(['aws']);
  }

  generatePassword() {
    return passwordGenerator.generate({
      length: 12, // 12 characters in password
      numbers: true, // include numbers in password
      symbols: true, // include symbols
      uppercase: true, // include uppercase
      strict: true, // make sure to include at least one character from each pool
    });
  }

  async createJwtSigningKey() {
    const aws = await this.service('aws');
    const ssm = new aws.sdk.SSM({ apiVersion: '2014-11-06' });
    const solutionName = this.settings.get(settingKeys.solutionName);
    const paramStoreJwtSecretName = this.settings.get(settingKeys.paramStoreJwtSecret);

    let doesKeyExist = false;
    try {
      await ssm.getParameter({ Name: paramStoreJwtSecretName, WithDecryption: true }).promise();
      doesKeyExist = true;
    } catch (err) {
      if (err.code !== 'ParameterNotFound') {
        // Swallow "ParameterNotFound" and let all other errors bubble up
        throw err;
      }
    }

    if (doesKeyExist) {
      this.log.info(
        `JWT signing key already exists in parameter store at ${paramStoreJwtSecretName}. Did not reset it.`,
      );
      // TODO: Support resetting JWT key
    } else {
      // Auto-generate signing key for the jwt tokens
      const jwtSigningKey = this.generatePassword();

      await ssm
        .putParameter({
          Name: paramStoreJwtSecretName,
          Type: 'SecureString',
          Value: jwtSigningKey,
          Description: `JWT signing key for ${solutionName}`,
          Overwrite: true,
        })
        .promise();

      this.log.info(`Created JWT signing key and saved it to parameter store at ${paramStoreJwtSecretName}`);
    }
  }

  async execute() {
    // The following will create new JWT signing key every time it is executed
    // TODO: Do not re-create JWT keys if they already exists, at the same time support for rotating the key
    return this.createJwtSigningKey();
  }
}

module.exports = CreateJwtKeyService;
