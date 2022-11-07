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

const Service = require('@amzn/base-services-container/lib/service');

const inputSchema = require('./schema/username-password-credentials.json');

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
    const { uid, isValid } = await dbPasswordService.validatePassword({ username, password });
    if (!isValid) {
      throw this.boom.invalidCredentials('Either the password is incorrect or the user does not exist', true);
    }
    return uid;
  }
}

module.exports = DbAuthenticationService;
