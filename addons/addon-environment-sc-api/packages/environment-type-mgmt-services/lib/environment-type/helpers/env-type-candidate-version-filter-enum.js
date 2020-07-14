const _ = require('lodash');

function includeOnlyLatest(versionFilter) {
  return versionFilter === versionFilterEnum.latest;
}
function includeAll(versionFilter) {
  return versionFilter === '*';
}

function getValidVersionFilters() {
  // wild-card indicates any version
  return ['*', versionFilterEnum.latest];
}

function isValidVersionFilter(versionFilter) {
  const validVersionFilters = getValidVersionFilters();
  return _.includes(validVersionFilters, versionFilter);
}

const versionFilterEnum = {
  // Currently only supporting to retrieve either latest version of all versions
  latest: 'latest',

  includeOnlyLatest,
  includeAll,
  isValidVersionFilter,
  getValidVersionFilters,
};

module.exports = versionFilterEnum;
