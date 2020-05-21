const _ = require('lodash');
const jwtDecode = require('jwt-decode');

const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  tableName: 'dbTableRevokedTokens',
};
class TokenRevocationService extends Service {
  constructor() {
    super();
    this.boom.extend(['invalidToken', 403]);
    this.dependency(['dbService']);
  }

  async revoke(requestContext, { token }) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    const record = await this.toTokenRevocationRecord(token);
    return dbService.helper
      .updater()
      .table(table)
      .key({ id: record.id })
      .item(record)
      .update();
  }

  async isRevoked({ token }) {
    // if the given token exists in the database table of revoked tokens then it is "revoked"
    return this.exists({ token });
  }

  async exists({ token }) {
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);
    const record = await this.toTokenRevocationRecord(token);
    const item = await dbService.helper
      .getter()
      .table(table)
      .key({ id: record.id })
      .get();

    return !!item;
  }

  /**
   * A method responsible for translating token into a token revocation record in {id, ttl} format.
   *
   * @param token
   * @returns {Promise<{id, ttl}>}
   */
  // All other methods in this class treat token as an opaque string. The knowledge of mapping token to it's identifier
  // and TTL is abstracted in this method.
  async toTokenRevocationRecord(token) {
    try {
      const payload = jwtDecode(token);
      const signature = token.split('.')[2];

      // use token's signature as the ID of the record for hash key (partition key)
      // Note that the max limit for partition key is 2048 bytes.
      // The JWT signatures are SHA256 (so always 256 bits) which are Base64 URL encoded so should fit in 2048 bytes.

      // Set the record's TTL as the token's expiry (i.e., let DynamoDB clear the record from the revocation table
      // after it is expired)
      return { id: signature, ttl: _.get(payload, 'exp', 0) };
    } catch (error) {
      throw this.boom.invalidToken('Invalid Token', true).cause(error);
    }
  }
}

module.exports = TokenRevocationService;
