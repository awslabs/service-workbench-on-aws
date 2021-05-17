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

/* eslint-disable import/prefer-default-export */
import _ from 'lodash';
import { httpApiGet, httpApiPost, httpApiPut, httpApiDelete } from '@aws-ee/base-ui/dist/helpers/api';
import { removeNulls } from '@aws-ee/base-ui/dist/helpers/utils';

function getUserRoles() {
  return httpApiGet('api/user-roles');
}

function getAwsAccounts() {
  return httpApiGet('api/aws-accounts');
}

// Note the accountUUID used here is the 'id' column in dbAwsAccounts table and 'id' attribute in AwsAccount.js, not AWS account id
function getAwsAccount(accountUUID) {
  return httpApiGet(`api/aws-accounts/${accountUUID}`);
}

// Note the accountUUID used here is the 'id' column in dbAwsAccounts table and 'id' attribute in AwsAccount.js, not AWS account id
function getAwsAccountBudget(accountUUID) {
  return httpApiGet(`api/budgets/aws-account/${accountUUID}`);
}

function createAwsAccountBudget(budgetConfiguration) {
  return httpApiPost(`api/budgets/aws-account`, { data: budgetConfiguration });
}

function updateAwsAccountBudget(budgetConfiguration) {
  return httpApiPut(`api/budgets/aws-account`, { data: budgetConfiguration });
}

function addUsers(users) {
  return httpApiPost('api/users/bulk', { data: users });
}

function addAwsAccount(awsAccount) {
  return httpApiPost('api/aws-accounts', { data: awsAccount });
}

function createAwsAccount(awsAccount) {
  return httpApiPost('api/aws-accounts/provision', { data: awsAccount });
}

function addIndex(index) {
  return httpApiPost('api/indexes', { data: index });
}

function updateUserApplication(user) {
  // Remove nulls and omit extra fields from the payload before calling the API
  // The user is identified by the uid in the url
  const data = removeNulls(
    _.omit(
      _.clone(user),
      'uid',
      'authenticationProviderId',
      'identityProviderName',
      'username',
      'ns',
      'createdBy',
      'updatedBy',
    ),
  );
  if (!data.userType) {
    // if userType is specified as empty string then make sure to delete it
    // the api requires this to be only one of the supported values (currently only supported value is 'root')
    delete data.userType;
  }
  return httpApiPut(`api/user`, { data });
}

async function deleteUser(user) {
  return httpApiDelete(`api/users/${user.uid}`);
}

function getStudies(category) {
  return httpApiGet('api/studies', { params: { category } });
}

function getStudy(id) {
  return httpApiGet(`api/studies/${id}`);
}

function createStudy(body) {
  return httpApiPost('api/studies', { data: body });
}

function listStudyFiles(studyId) {
  return httpApiGet(`api/studies/${studyId}/files`);
}

function getPresignedStudyUploadRequests(studyId, filenames) {
  if (Array.isArray(filenames)) {
    filenames = filenames.join(',');
  }
  return httpApiGet(`api/studies/${studyId}/upload-requests`, { params: { filenames } });
}

function getStudyPermissions(studyId) {
  return httpApiGet(`api/studies/${studyId}/permissions`);
}

function updateStudyPermissions(studyId, updateRequest) {
  return httpApiPut(`api/studies/${studyId}/permissions`, { data: updateRequest });
}

async function getStepTemplates() {
  return httpApiGet('api/step-templates');
}

function getEnvironments() {
  return httpApiGet('api/workspaces/built-in');
}

function getEnvironmentCost(id, numberDaysInPast, groupByService = true, groupByUser = false) {
  return httpApiGet(
    `api/costs?env=${id}&numberOfDaysInPast=${numberDaysInPast}&groupByService=${groupByService}&groupByUser=${groupByUser}`,
  );
}

function getAllProjCostGroupByUser(numberDaysInPast) {
  return httpApiGet(`api/costs?proj=ALL&groupByUser=true&numberOfDaysInPast=${numberDaysInPast}`);
}

function getAllProjCostGroupByEnv(numberDaysInPast) {
  return httpApiGet(`api/costs?proj=ALL&groupByEnv=true&numberOfDaysInPast=${numberDaysInPast}`);
}

function getEnvironment(id) {
  return httpApiGet(`api/workspaces/built-in/${id}`);
}

function deleteEnvironment(id) {
  return httpApiDelete(`api/workspaces/built-in/${id}`);
}

function createEnvironment(body) {
  return httpApiPost('api/workspaces/built-in', { data: body });
}

function updateEnvironment(body) {
  return httpApiPut('api/workspaces/built-in', { data: body });
}

function stopEnvironment(id) {
  return httpApiPut(`api/workspaces/built-in/${id}/stop`);
}

function startEnvironment(id) {
  return httpApiPut(`api/workspaces/built-in/${id}/start`);
}

function getEnvironmentKeypair(id) {
  return httpApiGet(`api/workspaces/built-in/${id}/keypair`);
}

function getEnvironmentPasswordData(id) {
  return httpApiGet(`api/workspaces/built-in/${id}/password`);
}

function getEnvironmentUrl(id) {
  return httpApiGet(`api/workspaces/built-in/${id}/url`);
}

function getEnvironmentSpotPriceHistory(type) {
  return httpApiGet(`api/workspaces/built-in/pricing/${type}`);
}

function getExternalTemplate(key) {
  return httpApiGet(`api/template/${key}`);
}

function getIndexes() {
  return httpApiGet('api/indexes');
}

function getIndex(indexId) {
  return httpApiGet(`api/indexes/${indexId}`);
}

function getProjects() {
  return httpApiGet('api/projects');
}

function getProject(id) {
  return httpApiGet(`api/projects/${id}`);
}

function deleteProject(id) {
  return httpApiDelete(`api/projects/${id}`);
}

function addProject(project) {
  return httpApiPost('api/projects', { data: project });
}

function updateProject(project) {
  return httpApiPut(`api/projects/${project.id}`, { data: project });
}

function getAccounts() {
  return httpApiGet('api/accounts');
}

function getAccount(id) {
  return httpApiGet(`api/accounts/${id}`);
}

function removeAccountInfo(id) {
  return httpApiDelete(`api/accounts/${id}`);
}

function getComputePlatforms() {
  return httpApiGet(`api/compute/platforms`);
}

function getComputeConfigurations(platformId) {
  return httpApiGet(`api/compute/platforms/${platformId}/configurations`);
}

function getClientIpAddress() {
  return httpApiGet(`api/ip`);
}

function getScEnvironmentCost(id, numberDaysInPast, groupByService = true, groupByUser = false) {
  return httpApiGet(
    `api/costs?scEnv=${id}&numberOfDaysInPast=${numberDaysInPast}&groupByService=${groupByService}&groupByUser=${groupByUser}`,
  );
}

function getScEnvironments() {
  return httpApiGet(`api/workspaces/service-catalog/`);
}

function getScEnvironment(id) {
  return httpApiGet(`api/workspaces/service-catalog/${id}`);
}

function createScEnvironment(scEnvironment) {
  return httpApiPost('api/workspaces/service-catalog/', { data: scEnvironment });
}

function createScEnvironmentConnectionUrl(envId, connectionId) {
  return httpApiPost(`api/workspaces/service-catalog/${envId}/connections/${connectionId}/url`);
}

function deleteScEnvironment(id) {
  return httpApiDelete(`api/workspaces/service-catalog/${id}`);
}

function stopScEnvironment(id) {
  return httpApiPut(`api/workspaces/service-catalog/${id}/stop`);
}

function startScEnvironment(id) {
  return httpApiPut(`api/workspaces/service-catalog/${id}/start`);
}

function updateScEnvironmentCidrs(id, updateRequest) {
  return httpApiPost(`api/workspaces/service-catalog/${id}/cidr`, { data: updateRequest });
}

function getScEnvironmentConnections(envId) {
  return httpApiGet(`api/workspaces/service-catalog/${envId}/connections/`);
}

function sendSshKey(envId, connectionId, keyPairId) {
  return httpApiPost(`api/workspaces/service-catalog/${envId}/connections/${connectionId}/send-ssh-public-key`, {
    data: { keyPairId },
  });
}

function getWindowsRpInfo(envId, connectionId) {
  return httpApiGet(`api/workspaces/service-catalog/${envId}/connections/${connectionId}/windows-rdp-info`);
}

function getDataSourceAccounts() {
  return httpApiGet(`api/data-sources/accounts/`);
}

function getDataSourceStudies(accountId) {
  return httpApiGet(`api/data-sources/accounts/${accountId}/studies`);
}

function checkAccountReachability(accountId) {
  return httpApiPost('api/data-sources/accounts/ops/reachability', {
    data: { id: accountId, type: 'dsAccount' },
  });
}

function checkStudyReachability(studyId) {
  return httpApiPost('api/data-sources/accounts/ops/reachability', {
    data: { id: studyId, type: 'study' },
  });
}

function registerAccount(account) {
  return httpApiPost('api/data-sources/accounts', {
    data: account,
  });
}

function registerBucket(accountId, bucket) {
  return httpApiPost(`api/data-sources/accounts/${accountId}/buckets`, {
    data: bucket,
  });
}

function registerStudy(accountId, bucketName, study) {
  return httpApiPost(`api/data-sources/accounts/${accountId}/buckets/${bucketName}/studies`, {
    data: study,
  });
}

function generateAccountCfnTemplate(accountId) {
  return httpApiPost(`api/data-sources/accounts/${accountId}/cfn`, {
    data: {},
  });
}

function updateRegisteredAccount(accountId, data) {
  return httpApiPut(`api/data-sources/accounts/${accountId}`, {
    data,
  });
}

export {
  addIndex,
  addUsers,
  removeAccountInfo,
  deleteUser,
  getUserRoles,
  getAwsAccounts,
  getAwsAccount,
  getAwsAccountBudget,
  createAwsAccountBudget,
  updateAwsAccountBudget,
  getStudies,
  getStudy,
  createStudy,
  listStudyFiles,
  getPresignedStudyUploadRequests,
  getStudyPermissions,
  updateStudyPermissions,
  addAwsAccount,
  createAwsAccount,
  getStepTemplates,
  getEnvironments,
  getEnvironment,
  getEnvironmentCost,
  deleteEnvironment,
  createEnvironment,
  updateEnvironment,
  stopEnvironment,
  startEnvironment,
  getEnvironmentKeypair,
  getEnvironmentPasswordData,
  getEnvironmentUrl,
  getEnvironmentSpotPriceHistory,
  getExternalTemplate,
  getAllProjCostGroupByUser,
  getIndexes,
  getIndex,
  getAllProjCostGroupByEnv,
  updateUserApplication,
  getProjects,
  getProject,
  addProject,
  updateProject,
  deleteProject,
  getAccounts,
  getAccount,
  getComputePlatforms,
  getComputeConfigurations,
  getClientIpAddress,
  getScEnvironmentCost,
  getScEnvironments,
  createScEnvironment,
  createScEnvironmentConnectionUrl,
  deleteScEnvironment,
  stopScEnvironment,
  startScEnvironment,
  getScEnvironment,
  getScEnvironmentConnections,
  updateScEnvironmentCidrs,
  sendSshKey,
  getWindowsRpInfo,
  getDataSourceAccounts,
  getDataSourceStudies,
  checkStudyReachability,
  checkAccountReachability,
  registerAccount,
  registerBucket,
  registerStudy,
  generateAccountCfnTemplate,
  updateRegisteredAccount,
};
