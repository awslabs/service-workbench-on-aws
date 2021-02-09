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

// This token should only be used for creating test resources
// And not for testing itself
async function getTestAdminClient(testConfig) {
  if (testConfig.authenticationProviderId === 'internal')
    return getInternalUserClient(testConfig.username, testConfig.password);
  throw new Error('Currently only internal auth provider is accepted in the integration test suite');
}

// This method leverages the API route '/api/authentication/id-tokens'
// to generate the user's bearer token
async function getInternalUserClient(username, password) {
  const params = getAuthIdTokenParams({
    username,
    password,
    authenticationProviderId: 'internal',
  });
  const response = await axios.post(params.api, params.payload);

  const axiosClient = await axios.create({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': response.data.idToken,
    },
  });

  return axiosClient;
}

module.exports = {
  getInternalUserClient,
  getTestAdminClient,
};
