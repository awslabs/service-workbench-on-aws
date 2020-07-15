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

function isApproved(status) {
  return status === envTypeStatusEnum.approved;
}
function isNotApproved(status) {
  // if status is falsy (undefined, null, empty string etc) then interpret
  // it as notApproved, by default
  return !status || status === envTypeStatusEnum.notApproved;
}

function getValidStatuses() {
  // wild-card indicates any status
  return ['*', envTypeStatusEnum.notApproved, envTypeStatusEnum.approved];
}

function isValidStatus(status) {
  const validStatuses = getValidStatuses();
  return _.includes(validStatuses, status);
}

const envTypeStatusEnum = {
  // An AWS Service Catalog Product that is imported in the "app store" but not approved for researchers' use yet
  notApproved: 'not-approved',

  // An AWS Service Catalog Product that is imported in the "app store" as an approved "environment type" for usage
  approved: 'approved',

  isApproved,
  isNotApproved,
  isValidStatus,
  getValidStatuses,
};

module.exports = envTypeStatusEnum;
