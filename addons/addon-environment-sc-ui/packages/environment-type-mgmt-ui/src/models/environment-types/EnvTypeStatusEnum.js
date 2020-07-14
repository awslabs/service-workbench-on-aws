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
