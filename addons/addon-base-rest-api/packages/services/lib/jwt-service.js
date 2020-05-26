/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

const Service = require('@aws-ee/base-services-container/lib/service');
const jwt = require('jsonwebtoken'); // https://github.com/auth0/node-jsonwebtoken/tree/v8.3.0
const _ = require('lodash');

const settingKeys = {
  paramStoreJwtSecret: 'paramStoreJwtSecret',
  jwtOptions: 'jwtOptions',
};

function removeNils(obj) {
  return _.transform(
    obj,
    (result, value, key) => {
      if (!_.isNil(value)) {
        result[key] = value;
      }
    },
    {},
  );
}

class JwtService extends Service {
  constructor() {
    super();
    this.boom.extend(['invalidToken', 403]);
    this.dependency('aws');
  }

  async init() {
    await super.init();
    const keyName = this.settings.get(settingKeys.paramStoreJwtSecret);
    this.secret = await this.getSecret(keyName);
  }

  async sign(payload, optionsOverride = {}) {
    const defaultOptions = this.settings.getObject(settingKeys.jwtOptions);

    // Create resultant options and remove Nil values (null or undefined) from the resultant options object.
    // This is done to allow removing an option using "optionsOverride"
    // For example, the defaultOptions "expiresIn": "2 days" but the we want to issue non-expiring token
    // we can pass optionsOverride with "expiresIn": undefined.
    // This will result in removing the "expiresIn" from the resultant options
    const options = removeNils(_.assign({}, defaultOptions, optionsOverride));

    return jwt.sign(payload, this.secret, options);
  }

  async verify(token) {
    try {
      const payload = await jwt.verify(token, this.secret);
      return payload;
    } catch (err) {
      throw this.boom.invalidToken('Invalid Token', true).cause(err);
    }
  }

  /**
   * Decodes a token and either returns the token payload or returns the complete decoded token as
   * { payload, header, signature } based on the "complete" flag.
   *
   * @param token The JWT token to decode
   *
   * @param complete A flag indicating whether to return just the payload or return the whole token in
   * { payload, header, signature } format after decoding. Defaults to true i.e., it returns the whole token.
   *
   * @param ignoreExpiration A flag indicating whether the decoding should ignore token expiration. If this flag is
   * false, the decoding will throw exception if an expired token is being decoded. Defaults to true i.e., it ignores expiration.
   *
   * @returns {Promise<*|boolean|undefined>}
   */
  async decode(token, { complete = true, ignoreExpiration = true } = {}) {
    try {
      // using verify method here instead of "decode" method because the "decode" method does not return signature
      // we want to return signature also when complete === true
      return jwt.verify(token, this.secret, { complete, ignoreExpiration });
    } catch (err) {
      throw this.boom.invalidToken('Invalid Token', true).cause(err);
    }
  }

  async getSecret(keyName) {
    const aws = await this.service('aws');
    const ssm = new aws.sdk.SSM({ apiVersion: '2014-11-06' });

    this.log.info(`Getting the "${keyName}" key from the parameter store`);
    const result = await ssm.getParameter({ Name: keyName, WithDecryption: true }).promise();
    return result.Parameter.Value;
  }
}

module.exports = JwtService;
