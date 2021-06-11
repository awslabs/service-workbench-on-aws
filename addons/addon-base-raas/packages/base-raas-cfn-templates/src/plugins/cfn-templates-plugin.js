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

// We are using Babel in this module to allow importing ".cfn.yml" files as plain text instead of parsing them webpack
// "yaml-loader", because in this case we want the text value not the parsed yaml as an object.
import ec2RStudioInstance from '../templates/ec2-rstudio-instance.cfn.yml';
import ec2LinuxInstance from '../templates/ec2-linux-instance.cfn.yml';
import ec2WindowsInstance from '../templates/ec2-windows-instance.cfn.yml';
import sagemakerInstance from '../templates/sagemaker-notebook-instance.cfn.yml';
import onboardAccount from '../templates/onboard-account.cfn.yml';
import storageGatewayNetworkInfra from '../templates/storage-gateway/network-infrastructure.cfn.yml';

const add = (name, yaml) => ({ name, yaml });

// The order is important, add your templates here
const templates = [
  add('ec2-rstudio-instance', ec2RStudioInstance),
  add('ec2-linux-instance', ec2LinuxInstance),
  add('ec2-windows-instance', ec2WindowsInstance),
  add('sagemaker-notebook-instance', sagemakerInstance),
  add('onboard-account', onboardAccount),
  add('storage-gateway-network-infra', storageGatewayNetworkInfra),
];

async function registerCfnTemplates(registry) {
  // eslint-disable-next-line no-restricted-syntax
  for (const template of templates) {
    await registry.add(template); // eslint-disable-line no-await-in-loop
  }
}

module.exports = { registerCfnTemplates };
