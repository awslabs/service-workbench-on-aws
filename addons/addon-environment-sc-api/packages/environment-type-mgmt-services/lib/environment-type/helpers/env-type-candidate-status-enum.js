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
