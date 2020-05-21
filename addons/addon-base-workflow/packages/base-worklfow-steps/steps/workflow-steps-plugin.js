/* eslint-disable global-require */
const obtainWriteLock = require('./obtain-write-lock/obtain-write-lock');
const obtainWriteLockYaml = require('./obtain-write-lock/obtain-write-lock.yml');
const releaseWriteLock = require('./release-write-lock/release-write-lock');
const releaseWriteLockYaml = require('./release-write-lock/release-write-lock.yml');

const add = (implClass, yaml) => ({ implClass, yaml });

// The order is important, add your steps here
const steps = [add(obtainWriteLock, obtainWriteLockYaml), add(releaseWriteLock, releaseWriteLockYaml)];

async function registerWorkflowSteps(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    const { implClass, yaml } = step;
    await registry.add({ implClass, yaml }); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowSteps };
