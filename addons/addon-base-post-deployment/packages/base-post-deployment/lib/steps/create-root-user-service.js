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

const passwordGenerator = require('generate-password');
const Service = require('@aws-ee/base-services-container/lib/service');
// const authProviderConstants = require('@aws-ee/base-api-services/lib/authentication-providers/constants')
//   .authenticationProviders;
// const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

// const settingKeys = {
//   paramStoreJwtSecret: 'paramStoreJwtSecret',
//   rootUserName: 'rootUserName',
//   rootUserEmail: 'rootUserEmail',
//   rootUserFirstName: 'rootUserFirstName',
//   rootUserLastName: 'rootUserLastName',
//   rootUserPasswordParamName: 'rootUserPasswordParamName',
//   solutionName: 'solutionName',
// };

class CreateRootUserService extends Service {
  constructor() {
    super();
    this.dependency(['userService', 'dbPasswordService', 'aws']);
  }

  // TODO: Create Root User in Cognito
  async createRootUser() {
    // const rootUserName = this.settings.get(settingKeys.rootUserName);
    // const rootUserEmail = this.settings.get(settingKeys.rootUserEmail);
    // const rootUserFirstName = this.settings.get(settingKeys.rootUserFirstName);
    // const rootUserLastName = this.settings.get(settingKeys.rootUserLastName);
    // const rootUserPasswordParamName = this.settings.get(settingKeys.rootUserPasswordParamName);
    // const solutionName = this.settings.get(settingKeys.solutionName);
    //
    // // Auto-generate password for the root user
    // const rootUserPassword = this.generatePassword();
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

  async execute() {
    return this.createRootUser();
  }
}

module.exports = CreateRootUserService;
