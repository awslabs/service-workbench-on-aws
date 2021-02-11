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

const fs = require('fs');
const YAML = require('js-yaml');

const testConfigPath = `../integration-tests/config/settings/${process.env.ENV_NAME}.yml`;
const testConfig = fs.existsSync(testConfigPath) ? YAML.load(fs.readFileSync(testConfigPath, 'utf8')) : {};
const apiEndpoint = testConfig.isLocal ? testConfig.localApiEndpoint : process.env.API_ENDPOINT;

// **************** IMPORTANT  ****************
// Please update this document if any SWB API is not found here
// ********************************************

function getAuthIdTokenParams(payload) {
  return { api: `${apiEndpoint}/api/authentication/id-tokens`, payload };
}

function getUserRolesParams() {
  return { api: `${apiEndpoint}/api/user-roles` };
}

function getUserParams() {
  return { api: `${apiEndpoint}/api/user` };
}

function updateUserParams(payload) {
  return { api: `${apiEndpoint}/api/user`, payload };
}

function getAwsAccountsParams() {
  return { api: `${apiEndpoint}/api/aws-accounts` };
}

// Note the accountUUID used here is the 'id' column in dbAwsAccounts table and 'id' attribute in AwsAccount.js, not AWS account id
function getAwsAccountParams(accountUUID) {
  return { api: `${apiEndpoint}/api/aws-accounts/${accountUUID}` };
}

// Note the accountUUID used here is the 'id' column in dbAwsAccounts table and 'id' attribute in AwsAccount.js, not AWS account id
function getAwsAccountBudgetParams(accountUUID) {
  return { api: `${apiEndpoint}/api/budgets/aws-account/${accountUUID}` };
}

function createAwsAccountBudgetParams(budgetConfiguration) {
  return { api: `${apiEndpoint}/api/budgets/aws-account`, body: budgetConfiguration };
}

function updateAwsAccountBudgetParams(budgetConfiguration) {
  return { api: `${apiEndpoint}/api/budgets/aws-account`, body: budgetConfiguration };
}

function addUserParams(user) {
  return { api: `${apiEndpoint}/api/users`, body: user };
}

function addUsersParams(users) {
  return { api: `${apiEndpoint}/api/users/bulk`, body: users };
}

function listUsersParams() {
  return { api: `${apiEndpoint}/api/users` };
}

function addAwsAccountParams(awsAccount) {
  return { api: `${apiEndpoint}/api/aws-accounts`, body: awsAccount };
}

function createAwsAccountParams(awsAccount) {
  return { api: `${apiEndpoint}/api/aws-accounts/provision`, body: awsAccount };
}

function addIndexParams(index) {
  return { api: `${apiEndpoint}/api/indexes`, body: index };
}

async function deleteUserParams(user) {
  return { api: `${apiEndpoint}/api/users/${user.uid}` };
}

function getStudiesParams(category) {
  const queryStringParam = `?category=${encodeURIComponent(category)}`;
  return { api: `${apiEndpoint}/api/studies${queryStringParam}` };
}

function getStudyParams(id) {
  return { api: `${apiEndpoint}/api/studies/${id}` };
}

function updateStudyParams(id, body) {
  return { api: `${apiEndpoint}/api/studies/${id}`, body };
}

function createStudyParams(body) {
  return { api: `${apiEndpoint}/api/studies`, body };
}

function listStudyFilesParams(studyId) {
  return { api: `${apiEndpoint}/api/studies/${studyId}/files` };
}

function getStudyPermissionsParams(studyId) {
  return { api: `${apiEndpoint}/api/studies/${studyId}/permissions` };
}

function updateStudyPermissionsParams(studyId, updateRequest) {
  return { api: `${apiEndpoint}/api/studies/${studyId}/permissions`, body: updateRequest };
}

async function getStepTemplatesParams() {
  return { api: `${apiEndpoint}/api/step-templates` };
}

function getEnvironmentsParams() {
  return { api: `${apiEndpoint}/api/workspaces/built-in` };
}

function getEnvironmentCostParams(id, numberDaysInPast, groupByService = true, groupByUser = false) {
  return {
    api: `${apiEndpoint}/api/costs?env=${id}&numberOfDaysInPast=${numberDaysInPast}&groupByService=${groupByService}&groupByUser=${groupByUser}`,
  };
}

function getAllProjCostGroupByUserParams(numberDaysInPast) {
  return { api: `${apiEndpoint}/api/costs?proj=ALL&groupByUser=true&numberOfDaysInPast=${numberDaysInPast}` };
}

function getAllProjCostGroupByEnvParams(numberDaysInPast) {
  return { api: `${apiEndpoint}/api/costs?proj=ALL&groupByEnv=true&numberOfDaysInPast=${numberDaysInPast}` };
}

function getEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/${id}` };
}

function deleteEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/${id}` };
}

function createEnvironmentParams(body) {
  return { api: `${apiEndpoint}/api/workspaces/built-in`, body };
}

function updateEnvironmentParams(body) {
  return { api: `${apiEndpoint}/api/workspaces/built-in`, body };
}

function stopEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/${id}/stop` };
}

function startEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/${id}/start` };
}

function getEnvironmentKeypairParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/${id}/keypair` };
}

function getEnvironmentPasswordDataParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/${id}/password` };
}

function getEnvironmentUrlParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/${id}/url` };
}

function getEnvironmentSpotPriceHistoryParams(type) {
  return { api: `${apiEndpoint}/api/workspaces/built-in/pricing/${type}` };
}

function getExternalTemplateParams(key) {
  return { api: `${apiEndpoint}/api/template/${key}` };
}

function getIndexesParams() {
  return { api: `${apiEndpoint}/api/indexes` };
}

function getIndexParams(indexId) {
  return { api: `${apiEndpoint}/api/indexes/${indexId}` };
}

function getProjectsParams() {
  return { api: `${apiEndpoint}/api/projects` };
}

function getProjectParams(id) {
  return { api: `${apiEndpoint}/api/projects/${id}` };
}

function deleteProjectParams(id) {
  return { api: `${apiEndpoint}/api/projects/${id}` };
}

function addProjectParams(project) {
  return { api: `${apiEndpoint}/api/projects`, body: project };
}

function updateProjectParams(project) {
  return { api: `${apiEndpoint}/api/projects/${project.id}`, body: project };
}

function getAccountsParams() {
  return { api: `${apiEndpoint}/api/accounts` };
}

function getAccountParams(id) {
  return { api: `${apiEndpoint}/api/accounts/${id}` };
}

function removeAccountInfoParams(id) {
  return { api: `${apiEndpoint}/api/accounts/${id}` };
}

function getComputePlatformsParams() {
  return { api: `${apiEndpoint}/api/compute/platforms` };
}

function getComputeConfigurationsParams(platformId) {
  return { api: `${apiEndpoint}/api/compute/platforms/${platformId}/configurations` };
}

function getClientIpAddressParams() {
  return { api: `${apiEndpoint}/api/ip` };
}

function getScEnvironmentCostParams(id, numberDaysInPast, groupByService = true, groupByUser = false) {
  return {
    api: `${apiEndpoint}/api/costs?scEnv=${id}&numberOfDaysInPast=${numberDaysInPast}&groupByService=${groupByService}&groupByUser=${groupByUser}`,
  };
}

function getScEnvironmentsParams() {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/` };
}

function getScEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${id}` };
}

function createScEnvironmentParams(scEnvironment) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/`, body: scEnvironment };
}

function createScEnvironmentConnectionUrlParams(envId, connectionId) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${envId}/connections/${connectionId}/url` };
}

function deleteScEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${id}` };
}

function stopScEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${id}/stop` };
}

function startScEnvironmentParams(id) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${id}/start` };
}

function updateScEnvironmentCidrsParams(id, updateRequest) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${id}/cidr`, body: updateRequest };
}

function getScEnvironmentConnectionsParams(envId) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${envId}/connections/` };
}

function sendSshKeyParams(envId, connectionId, keyPairId) {
  return {
    api: `${apiEndpoint}/api/workspaces/service-catalog/${envId}/connections/${connectionId}/send-ssh-public-key`,

    body: { keyPairId },
  };
}

function getWindowsRpInfoParams(envId, connectionId) {
  return { api: `${apiEndpoint}/api/workspaces/service-catalog/${envId}/connections/${connectionId}/windows-rdp-info` };
}

module.exports = {
  getAuthIdTokenParams,
  addIndexParams,
  listUsersParams,
  addUsersParams,
  removeAccountInfoParams,
  deleteUserParams,
  getUserRolesParams,
  getAwsAccountsParams,
  getAwsAccountParams,
  getAwsAccountBudgetParams,
  createAwsAccountBudgetParams,
  addUserParams,
  updateAwsAccountBudgetParams,
  getStudiesParams,
  getStudyParams,
  createStudyParams,
  getUserParams,
  updateUserParams,
  listStudyFilesParams,
  getStudyPermissionsParams,
  updateStudyPermissionsParams,
  updateStudyParams,
  addAwsAccountParams,
  createAwsAccountParams,
  getStepTemplatesParams,
  getEnvironmentsParams,
  getEnvironmentParams,
  getEnvironmentCostParams,
  deleteEnvironmentParams,
  createEnvironmentParams,
  updateEnvironmentParams,
  stopEnvironmentParams,
  startEnvironmentParams,
  getEnvironmentKeypairParams,
  getEnvironmentPasswordDataParams,
  getEnvironmentUrlParams,
  getEnvironmentSpotPriceHistoryParams,
  getExternalTemplateParams,
  getAllProjCostGroupByUserParams,
  getIndexesParams,
  getIndexParams,
  getAllProjCostGroupByEnvParams,
  getProjectsParams,
  getProjectParams,
  addProjectParams,
  updateProjectParams,
  deleteProjectParams,
  getAccountsParams,
  getAccountParams,
  getComputePlatformsParams,
  getComputeConfigurationsParams,
  getClientIpAddressParams,
  getScEnvironmentCostParams,
  getScEnvironmentsParams,
  createScEnvironmentParams,
  createScEnvironmentConnectionUrlParams,
  deleteScEnvironmentParams,
  stopScEnvironmentParams,
  startScEnvironmentParams,
  getScEnvironmentParams,
  getScEnvironmentConnectionsParams,
  updateScEnvironmentCidrsParams,
  sendSshKeyParams,
  getWindowsRpInfoParams,
};
