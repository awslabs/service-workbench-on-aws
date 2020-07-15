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

function isNotImported(status) {
  return status === envTypeCandidateStatusEnum.notImported;
}
function getValidStatuses() {
  // wild-card indicates any status
  return ['*', envTypeCandidateStatusEnum.notImported];
}

function isValidStatus(status) {
  const validStatuses = getValidStatuses();
  return _.includes(validStatuses, status);
}

const envTypeCandidateStatusEnum = {
  // Currently only supporting to retrieve either not imported
  // AWS Service Catalog Products or all accessible AWS Service Catalog Products
  // These product-version combos are candidates for being imported
  // as environment types in the system
  notImported: 'not-imported', // An AWS Service Catalog Product not yet imported in the "app store"

  isNotImported,
  isValidStatus,
  getValidStatuses,
};

module.exports = envTypeCandidateStatusEnum;
