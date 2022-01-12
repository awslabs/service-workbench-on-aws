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

const _ = require('lodash');
const passwordGenerator = require('generate-password');
const Service = require('@aws-ee/base-services-container/lib/service');
const authProviderConstants = require('@aws-ee/base-api-services/lib/authentication-providers/constants')
  .authenticationProviders;
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const settingKeys = {
  paramStoreJwtSecret: 'paramStoreJwtSecret',
  rootUserName: 'rootUserName',
  rootUserEmail: 'rootUserEmail',
  rootUserFirstName: 'rootUserFirstName',
  rootUserLastName: 'rootUserLastName',
  rootUserPasswordParamName: 'rootUserPasswordParamName',
  envName: 'envName',
  solutionName: 'solutionName',
  nativeAdminPasswordParamName: 'nativeAdminPasswordParamName',
  enableNativeUserPoolUsers: 'enableNativeUserPoolUsers',
  awsRegion: 'awsRegion',
};

class CreateRootUserService extends Service {
  constructor() {
    super();
    this.dependency(['userService', 'dbPasswordService', 'aws']);
  }

  async createRootUser() {
    const rootUserName = this.settings.get(settingKeys.rootUserName);
    const rootUserEmail = this.settings.get(settingKeys.rootUserEmail);
    const rootUserFirstName = this.settings.get(settingKeys.rootUserFirstName);
    const rootUserLastName = this.settings.get(settingKeys.rootUserLastName);
    const rootUserPasswordParamName = this.settings.get(settingKeys.rootUserPasswordParamName);
    const solutionName = this.settings.get(settingKeys.solutionName);

    // Auto-generate password for the root user
    const rootUserPassword = this.generatePassword();

    const [userService, dbPasswordService, aws] = await this.service(['userService', 'dbPasswordService', 'aws']);

    try {
      const createdUser = await userService.createUser(getSystemRequestContext(), {
        username: rootUserName,
        authenticationProviderId: authProviderConstants.internalAuthProviderId,
        firstName: rootUserFirstName,
        lastName: rootUserLastName,
        email: rootUserEmail,
        isAdmin: true,
        userType: 'root',
      });
      this.log.info('Created root user in the data lake');

      await dbPasswordService.saveRootPassword(getSystemRequestContext(), {
        uid: createdUser.uid,
        password: rootUserPassword,
      });
      this.log.info("Created root user's password");

      const ssm = new aws.sdk.SSM({ apiVersion: '2014-11-06' });
      await ssm
        .putParameter({
          Name: rootUserPasswordParamName,
          Type: 'SecureString',
          Value: rootUserPassword,
          Description: `root user password for the ${solutionName}`,
          Overwrite: true,
        })
        .promise();
      this.log.info(`Created root user with user name = ${rootUserName}`);
      this.log.info(`Please find the root user's password in parameter store at = ${rootUserPasswordParamName}`);
    } catch (err) {
      if (err.code === 'alreadyExists') {
        // TODO: Allow updating root users information in post-deployment
        // The root user already exists. Nothing to do.
        this.log.info(
          `The root user with user name = ${rootUserName} already exists. Did NOT overwrite that user's information.`,
        );
      } else {
        // In case of any other error let it bubble up
        throw err;
      }
    }
  }

  async createNativeAdminUser() {
    if (!this.settings.getBoolean(settingKeys.enableNativeUserPoolUsers)) {
      this.log.info('Cognito Native User Pool is turned off for this installation. Skipping initial admin creation');
      return;
    }

    const nativeAdminUserEmail = this.settings.get(settingKeys.rootUserEmail);
    const nativeAdminUserFirstName = this.settings.get(settingKeys.rootUserFirstName);
    const nativeAdminUserLastName = this.settings.get(settingKeys.rootUserLastName);
    const nativeAdminPasswordParamName = this.settings.get(settingKeys.nativeAdminPasswordParamName);
    const solutionName = this.settings.get(settingKeys.solutionName);
    const awsRegion = this.settings.get(settingKeys.awsRegion);

    // Auto-generate password for the native admin user
    const nativeAdminPassword = this.generatePassword();

    const [userService, aws] = await this.service(['userService', 'aws']);

    try {
      await userService.createUser(getSystemRequestContext(), {
        username: nativeAdminUserEmail,
        authenticationProviderId: `https://cognito-idp.${awsRegion}.amazonaws.com/${userPoolId}`,
        identityProviderName: 'Cognito Native Pool',
        firstName: nativeAdminUserFirstName,
        lastName: nativeAdminUserLastName,
        email: nativeAdminUserEmail,
        isAdmin: true,
        status: 'active',
        userRole: 'admin',
      });

      const cognitoIdentityServiceProvider = new aws.sdk.CognitoIdentityServiceProvider();
      const result = await cognitoIdentityServiceProvider.listUserPools({ MaxResults: '60' }).promise();
      this.log.info(`${JSON.stringify(result)}`);
      const envName = this.settings.get(settingKeys.envName);
      const userPoolName = `${envName}-${solutionName}-userPool`;
      const userPool = _.find(result.UserPools, { Name: userPoolName });

      if (!userPool)
        // TODO - future: When we deprecate internal authentication, code inside this if block should throw an error
        this.log.info(
          'Cognito User Pool is not available. This means only internal authentication provider is being used',
        );

      const userPoolId = userPool.Id;
      try {
        await cognitoIdentityServiceProvider
          .adminGetUser({ Username: nativeAdminUserEmail, UserPoolId: userPoolId })
          .promise();
        this.log.info(
          `The native cognito user ${nativeAdminUserEmail} already exists in user pool ${userPoolId}. Not creating a new one.`,
        );
      } catch (err) {
        if (err.code === 'UserNotFoundException') {
          this.log.info(
            `User with username ${nativeAdminUserEmail} not found in native user pool ${userPoolId}. Creating a new one.`,
          );
          const nativeAdminParams = {
            TemporaryPassword: nativeAdminPassword,
            UserAttributes: [
              {
                Name: 'family_name',
                Value: nativeAdminUserLastName,
              },
              {
                Name: 'name',
                Value: nativeAdminUserFirstName,
              },
              {
                Name: 'given_name',
                Value: nativeAdminUserFirstName,
              },
              {
                Name: 'email',
                Value: nativeAdminUserEmail,
              },
            ],
            Username: nativeAdminUserEmail,
            UserPoolId: userPoolId,
          };
          await cognitoIdentityServiceProvider.adminCreateUser(nativeAdminParams).promise();
        } else {
          throw this.boom.badRequest(
            `There was a problem getting the default native pool user. Username: ${nativeAdminUserEmail} UserPoolId: ${userPoolId}. Error code: ${err.code}`,
            true,
          );
        }
      }

      const ssm = new aws.sdk.SSM({ apiVersion: '2014-11-06' });
      await ssm
        .putParameter({
          Name: nativeAdminPasswordParamName,
          Type: 'SecureString',
          Value: nativeAdminPassword,
          Description: `Native pool user password for the ${solutionName}`,
          Overwrite: true,
        })
        .promise();
      this.log.info(`Created native pool user with user name = ${nativeAdminUserEmail}`);
      this.log.info(
        `Please find the native pool user password in parameter store at = ${nativeAdminPasswordParamName}`,
      );
    } catch (err) {
      if (err.code === 'alreadyExists') {
        // The native admin already exists. Nothing to do.
        this.log.info(
          `The user with user name = ${nativeAdminUserEmail} already exists. Did NOT overwrite that user's information.`,
        );
      } else {
        // In case of any other error let it bubble up
        throw err;
      }
    }
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
    await this.createRootUser();
    await this.createNativeAdminUser();
  }
}

module.exports = CreateRootUserService;
