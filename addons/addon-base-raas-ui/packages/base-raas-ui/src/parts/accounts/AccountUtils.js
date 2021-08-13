import _ from 'lodash';

function getAccountIdsOfActiveEnvironments(scEnvs, projects, indexes) {
  const nonActiveStates = ['FAILED', 'TERMINATED', 'UNKNOWN'];
  const activeEnvs = scEnvs.filter(env => {
    return !nonActiveStates.includes(env.status);
  });
  const projectToActiveEnvs = _.groupBy(activeEnvs, 'projectId');

  const indexIdToAwsAccountId = {};
  indexes.forEach(index => {
    indexIdToAwsAccountId[index.id] = index.awsAccountId;
  });

  const projectIdToAwsAccountId = {};
  projects.forEach(project => {
    projectIdToAwsAccountId[project.id] = indexIdToAwsAccountId[project.indexId];
  });

  return Object.keys(projectToActiveEnvs).map(projectId => {
    return projectIdToAwsAccountId[projectId];
  });
}

module.exports = {
  getAccountIdsOfActiveEnvironments,
};
