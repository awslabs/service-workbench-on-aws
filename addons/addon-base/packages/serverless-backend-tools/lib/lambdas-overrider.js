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
const chalk = require('chalk');

const { formatObject } = require('./utils');

class LambdasOverrider {
  constructor({ serverless, options }) {
    this.serverless = serverless;
    this.options = options;
    this.cli = {
      log(message) {
        serverless.cli.consoleLog(`[backend-tools] ${chalk.yellowBright(message)}`);
      },
      warn(message) {
        serverless.cli.consoleLog(`[backend-tools] ${chalk.redBright(message)}`);
      },
    };
  }

  async overrideEnvironments({ aws }) {
    const service = this.serverless.service;
    const stackName = service.provider.stackName;
    const lambdasOverrides = _.get(service.custom, 'backendTools.environmentOverrides.lambdas', {});
    const providerOverrides = _.get(service.custom, 'backendTools.environmentOverrides.provider', {});
    const names = _.keys(lambdasOverrides);

    const stackOutput = await this.getStackOutput({ aws, stackName });
    const cfnOutput = key => {
      const value = stackOutput[key];
      if (_.isUndefined(value))
        throw new Error(`The stack output "${key}" is not found. You referenced it in environmentOverrides.`);
      return value;
    };
    const resolveIt = value => _.template(value)({ cfnOutput });

    // time to resolve all expressions in the environmentOverrides.provider
    // and then merge it to the provider.environment
    const resolvedProvider = {};
    _.forEach(providerOverrides, (value, key) => {
      resolvedProvider[key] = resolveIt(value);
    });
    service.provider.environment = { ...service.provider.environment, ...resolvedProvider };
    this.cli.log(`"provider environment:\n${formatObject(service.provider.environment)}\n`);

    // time to resolve all expressions in the environmentOverrides.lambdas
    // we want a map of the lambda name and all its resolved expressions
    // example:  { 'apiHandler': { 'env1': '<resolved>', 'env2': '<resolved2> } , ...}
    const resolvedMap = {};
    _.forEach(names, name => {
      const entries = lambdasOverrides[name].environment || {};
      const envMap = {};
      _.forEach(entries, (value, key) => {
        envMap[key] = resolveIt(value);
      });
      resolvedMap[name] = envMap;
    });

    // we now loop through all the defined functions and override their environments
    _.forEach(names, name => {
      const lambdaEntry = _.get(service.functions, name);
      if (_.isEmpty(lambdaEntry)) {
        this.cli.warn(`Lambda "${name}" is not defined but yet it was specified in environmentOverrides`);
        return;
      }
      lambdaEntry.environment = { ...service.provider.environment, ...lambdaEntry.environment, ...resolvedMap[name] };

      // Now lets check if this is a local invoke
      if (this.isInvokeLocal(name)) {
        _.merge(process.env, lambdaEntry.environment);
      }

      this.cli.log(`"${name}" Lambda environment:\n${formatObject(lambdaEntry.environment)}\n`);
    });
  }

  async getStackOutput({ aws, stackName }) {
    const cfn = new aws.CloudFormation();
    const raw = await cfn.describeStacks({ StackName: stackName }).promise();
    const data = _.get(raw, 'Stacks[0]');
    const outputs = _.get(data, 'Outputs', []);

    const result = {};
    _.forEach(outputs, item => {
      result[item.OutputKey] = item.OutputValue;
    });

    return result;
  }

  // Here is the deal, the AwsInvokeLocal plugin captures the environments before we get a chance to override it for
  // local dev. So, the solution is to inject the env variables directly to process.env, just like how the AwsInvokeLocal
  // is doing it.
  isInvokeLocal(fnName) {
    return this.options.f === fnName || this.options.function === fnName;
  }
}

module.exports = LambdasOverrider;
