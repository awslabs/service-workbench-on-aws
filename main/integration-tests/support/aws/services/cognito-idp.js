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
const assert = require('assert');

class CognitoIdp {
  constructor({ aws, sdk }) {
    this.aws = aws;
    this.sdk = sdk;
  }

  async getIdToken({ username, password, userPoolId, appClientId } = {}) {
    assert(username, 'username is required');
    assert(password, 'password is required');
    assert(userPoolId, 'userPoolId is required');
    assert(appClientId, 'appClientId is required');

    const payload = {
      UserPoolId: userPoolId,
      ClientId: appClientId,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    };

    const response = await this.sdk.adminInitiateAuth(payload).promise();
    return _.get(response.AuthenticationResult, 'IdToken');
  }

  async signUpUser({ username, password, appClientId, fullName } = {}) {
    assert(username, 'username is required');
    assert(password, 'password is required');
    assert(appClientId, 'appClientId is required');
    const firstName = fullName.split(' ')[0];
    const lastName = fullName.split(' ')[1];

    const payload = {
      ClientId: appClientId,
      Password: password,
      Username: username,
      UserAttributes: [
        { Name: 'name', Value: firstName },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
      ],
    };

    await this.sdk.signUp(payload).promise();
  }

  async deleteUser({ username, userPoolId } = {}) {
    assert(username, 'username is required');
    assert(userPoolId, 'userPoolId is required');

    const payload = {
      UserPoolId: userPoolId,
      Username: username,
    };

    await this.sdk.adminDeleteUser(payload).promise();
  }
}

// The aws javascript sdk client name
CognitoIdp.clientName = 'CognitoIdentityServiceProvider';

module.exports = CognitoIdp;
