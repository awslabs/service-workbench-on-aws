const chalk = require('chalk');
const aws = require('aws-sdk');

const LambdasOverrider = require('./lib/lambdas-overrider');

class BackendTools {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.hooks = {
      'before:offline:start': this.resolveOverrides.bind(this), // event fired by serverless-offline
      'before:invoke:local:loadEnvVars': this.resolveOverrides.bind(this), // event fired by the invoke plugin
    };

    this.cli = {
      raw(message) {
        serverless.cli.consoleLog(chalk.dim(message));
      },
      log(prefix = '', message) {
        serverless.cli.consoleLog(`${prefix} ${chalk.yellowBright(message)}`);
      },
      warn(prefix = '', message) {
        serverless.cli.consoleLog(`${prefix} ${chalk.redBright(message)}`);
      },
    };

    this.lambdasOverrider = new LambdasOverrider({ serverless, options });
  }

  async resolveOverrides() {
    const awsInstance = this.prepareAws();
    return this.lambdasOverrider.overrideEnvironments({ aws: awsInstance });
  }

  prepareAws() {
    const profile = this.serverless.service.custom.settings.awsProfile;
    const region = this.serverless.service.custom.settings.awsRegion;
    const credentials = new aws.SharedIniFileCredentials({ profile });

    // setup profile and region
    process.env.AWS_REGION = region;
    process.env.AWS_PROFILE = profile;

    aws.config.update({
      maxRetries: 3,
      region,
      sslEnabled: true,
      credentials,
    });

    return aws;
  }
}

module.exports = BackendTools;
