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
const assert = require('assert');
const axios = require('axios').default;

const { transform } = require('./axios-error');

async function getIdToken({ username, password, apiEndpoint, authenticationProviderId = 'internal' } = {}) {
  assert(username, 'username is required');
  assert(password, 'password is required');
  assert(apiEndpoint, 'apiEndpoint is required');
  assert.strictEqual(authenticationProviderId, 'internal', 'only "internal" authenticationProviderId is supported');

  const payload = {
    username,
    password,
    authenticationProviderId,
  };

  try {
    const response = await axios.post(`${apiEndpoint}/api/authentication/id-tokens`, payload);
    return response.data.idToken;
  } catch (error) {
    // We transform the axios error so that we can capture the boom code and payload attributes passed from the server
    throw transform(error);
  }
}

module.exports = {
  getIdToken,
};
