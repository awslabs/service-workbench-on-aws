const Service = require('@aws-ee/base-services-container/lib/service');

const inputSchema = require('./schema/username-password-credentials');

class DbAuthenticationService extends Service {
  constructor() {
    super();
    this.boom.extend(['invalidCredentials', 401]);
    this.dependency(['jsonSchemaValidationService', 'dbPasswordService']);
  }

  async authenticate(credentials) {
    const [jsonSchemaValidationService, dbPasswordService] = await this.service([
      'jsonSchemaValidationService',
      'dbPasswordService',
    ]);

    // Validate input
    await jsonSchemaValidationService.ensureValid(credentials, inputSchema);

    const { username, password } = credentials;
    const exists = await dbPasswordService.exists({ username, password });
    if (!exists) {
      throw this.boom.invalidCredentials('Either the password is incorrect or the user does not exist', true);
    }
  }
}

module.exports = DbAuthenticationService;
