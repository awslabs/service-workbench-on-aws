// We are using Babel in this module to allow importing ".cfn.yml" files as plain text instead of parsing them webpack
// "yaml-loader", because in this case we want the text value not the parsed yaml as an object.
import ec2LinuxInstance from '../templates/ec2-linux-instance.cfn.yml';
import ec2WindowsInstance from '../templates/ec2-windows-instance.cfn.yml';
import sagemakerInstance from '../templates/sagemaker-notebook-instance.cfn.yml';
import emrCluster from '../templates/emr-cluster.cfn.yml';
import onboardAccount from '../templates/onboard-account.cfn.yml';

const add = (name, yaml) => ({ name, yaml });

// The order is important, add your templates here
const templates = [
  add('ec2-linux-instance', ec2LinuxInstance),
  add('ec2-windows-instance', ec2WindowsInstance),
  add('sagemaker-notebook-instance', sagemakerInstance),
  add('emr-cluster', emrCluster),
  add('onboard-account', onboardAccount),
];

async function registerCfnTemplates(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const template of templates) {
    await registry.add(template); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerCfnTemplates };
