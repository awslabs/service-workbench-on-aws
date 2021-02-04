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
const { getStudyParams } = require('../helpers/api-param-generator');
const { createStudyParams, getStudiesParams } = require('../helpers/api-param-generator');
const { validResponse, RESOURCE_DESCRIPTION } = require('./common');

// ************************ Study templates ************************

function createStudyJson({ projectId, category = 'My Studies', testName = randomString(5) } = {}) {
  const studyId = `IntegTest-${testName}-Study-${new Date().getTime()}`;
  return {
    id: studyId,
    name: studyId,
    category,
    description: RESOURCE_DESCRIPTION,
    projectId,
    uploadLocationEnabled: true,
  };
}

// ************************ API calls ************************

async function getStudy(bearerToken, studyId) {
  const params = getStudyParams(studyId);
  const headers = { 'Authorization': bearerToken, 'Content-Type': 'application/json' };
  const response = await axios.get(params.api, { headers });

  if (validResponse(response)) return response.data;
  throw new Error('getStudy response was different than expected');
}

async function listStudies(bearerToken, category) {
  const params = getStudiesParams(category);
  const headers = { 'Authorization': bearerToken, 'Content-Type': 'application/json' };
  const response = await axios.get(params.api, { headers });

  if (validResponse(response)) return response.data;
  throw new Error('getStudy response was different than expected');
}

async function createStudy(bearerToken, studyToCreate = {}) {
  const headers = { 'Authorization': bearerToken, 'Content-Type': 'application/json' };
  const params = createStudyParams(studyToCreate);

  const response = await axios.post(params.api, params.body, { headers });
  return response.data;
}

module.exports = {
  getStudy,
  listStudies,
  createStudy,
  createStudyJson,
  validResponse,
};
