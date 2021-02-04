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

const axios = require('axios').default;
const { getAuthIdTokenParams } = require('../helpers/api-param-generator');
const { validResponse } = require('./common');

// This token should only be used for creating test resources
// And not for testing itself
async function getTestAdminToken(testConfig) {
  if (testConfig.authenticationProviderId === 'internal')
    return getInternalUserToken(testConfig.username, testConfig.password);
  throw new Error('Currently only internal auth provider is accepted in the integration test suite');
}

async function getInternalUserToken(username, password) {
  const params = getAuthIdTokenParams({
    username,
    password,
    authenticationProviderId: 'internal',
  });
  const response = await axios.post(params.api, params.payload);
  if (validResponse(response)) return response.data.idToken;
  throw new Error('getInternalUserToken response was different than expected');
}

module.exports = {
  getInternalUserToken,
  getTestAdminToken,
};
