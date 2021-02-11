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

const { randomString } = require('@aws-ee/base-services/lib/helpers/utils');
const { getStudyParams } = require('../helpers/api-param-generator');
const { createStudyParams, getStudiesParams } = require('../helpers/api-param-generator');
const { RESOURCE_DESCRIPTION } = require('./common');

// ************************ Study templates ************************

function buildStudyJson({ projectId, category = 'My Studies', testName = randomString(5) } = {}) {
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

async function getStudy(axiosClient, studyId) {
  const params = getStudyParams(studyId);
  const response = await axiosClient.get(params.api);
  return response.data;
}

async function listStudies(axiosClient, category) {
  const params = getStudiesParams(category);
  const response = await axiosClient.get(params.api);
  return response.data;
}

async function createStudy(axiosClient, studyToCreate = {}) {
  const params = createStudyParams(studyToCreate);
  const response = await axiosClient.post(params.api, params.body);
  return response.data;
}

module.exports = {
  getStudy,
  listStudies,
  createStudy,
  buildStudyJson,
};
