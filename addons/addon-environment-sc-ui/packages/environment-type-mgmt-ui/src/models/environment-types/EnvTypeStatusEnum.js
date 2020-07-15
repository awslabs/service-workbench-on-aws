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

function isApproved(status) {
  return status === EnvTypeStatusEnum.approved;
}
function isNotApproved(status) {
  // if status is falsy (undefined, null, empty string etc) then interpret
  // it as notApproved, by default
  return !status || status === EnvTypeStatusEnum.notApproved;
}

function getValidStatuses() {
  return [EnvTypeStatusEnum.notApproved, EnvTypeStatusEnum.approved];
}

const EnvTypeStatusEnum = {
  // An AWS Service Catalog Product that is imported in the "app store" but not approved for researchers' use yet
  notApproved: 'not-approved',

  // An AWS Service Catalog Product that is imported in the "app store" as an approved "environment type" for usage
  approved: 'approved',

  isApproved,
  isNotApproved,
  getValidStatuses,
};

module.exports = EnvTypeStatusEnum;
