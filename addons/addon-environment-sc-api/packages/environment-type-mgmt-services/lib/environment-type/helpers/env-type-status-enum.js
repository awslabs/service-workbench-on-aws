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
