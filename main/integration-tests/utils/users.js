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
const { randomString } = require('@aws-ee/base-services/lib/helpers/utils');
const { addUserParams, listUsersParams } = require('../helpers/api-param-generator');
const { validResponse } = require('./common');

function createUserJson({ projId, testName = randomString(5), isAdmin = false, status = 'active' } = {}) {
  const userName = `test+${testName}-${new Date().getTime()}-@example.com`;

  return {
    username: userName,
    firstName: 'Test',
    lastName: 'User',
    email: userName,
    isAdmin,
    status,
    password: '1234',
    projectId: projId ? [projId] : [],
    userRole: 'researcher',
  };
}

async function createUser(bearerToken, userToCreate = {}) {
  const headers = { 'Authorization': bearerToken, 'Content-Type': 'application/json' };
  const params = addUserParams(userToCreate);
  const response = await axios.post(params.api, params.body, { headers });
  return response.data;
}

async function listUsers(bearerToken) {
  const params = listUsersParams();
  const headers = { 'Authorization': bearerToken, 'Content-Type': 'application/json' };
  const response = await axios.get(params.api, { headers });
  if (validResponse(response)) return response.data;

  throw new Error('listUsers response was different than expected');
}

module.exports = {
  createUser,
  createUserJson,
  listUsers,
};
