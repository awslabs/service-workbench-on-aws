const readEnvironmentInfo = require('../steps/read-environment-info/read-environment-info');
const readEnvironmentInfoYaml = require('../steps/read-environment-info/read-environment-info.yml');

const replicateLaunchConstraintInTargetAcc = require('../steps/replicate-launch-constraint-in-target-acc/replicate-launch-constraint-in-target-acc');
const replicateLaunchConstraintInTargetAccYaml = require('../steps/replicate-launch-constraint-in-target-acc/replicate-launch-constraint-in-target-acc.yml');

const sharePortfolioWithTargetAcc = require('../steps/share-portfolio-with-target-acc/share-portfolio-with-target-acc');
const sharePortfolioWithTargetAccYaml = require('../steps/share-portfolio-with-target-acc/share-portfolio-with-target-acc.yml');

const launchProduct = require('../steps/launch-product/launch-product');
const launchProductYaml = require('../steps/launch-product/launch-product.yml');

const terminateProduct = require('../steps/terminate-product/terminate-product');
const terminateProductYaml = require('../steps/terminate-product/terminate-product.yml');

const add = (implClass, yaml) => ({ implClass, yaml });

// The order is important, add your steps here
const steps = [
  add(readEnvironmentInfo, readEnvironmentInfoYaml),
  add(replicateLaunchConstraintInTargetAcc, replicateLaunchConstraintInTargetAccYaml),
  add(sharePortfolioWithTargetAcc, sharePortfolioWithTargetAccYaml),
  add(launchProduct, launchProductYaml),
  add(terminateProduct, terminateProductYaml),
];

async function registerWorkflowSteps(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const step of steps) {
    const { implClass, yaml } = step;
    await registry.add({ implClass, yaml }); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerWorkflowSteps };
