const { execSync } = require('child_process');
const { createReadStream } = require('fs');
const path = require('path');
const _ = require('lodash');
const chalk = require('chalk');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

// TODO: Make this a generic build artifact and upload to s3 tool in the future
// ie - remove the hard-coded go bits and make it more extensible.
class GoBuildTools {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      'build-go': {
        usage: 'Build the go tooling',
        lifecycleEvents: ['build'],
      },
      'deploy-go': {
        usage: 'Build and deploy the go tooling',
        lifecycleEvents: ['build', 'deploy'],
      },
    };

    this.cli = {
      log(prefix = '', message) {
        serverless.cli.consoleLog(`[serverless-go-build-tools] ${prefix} ${chalk.yellowBright(message)}`);
      },
      warn(prefix = '', message) {
        serverless.cli.consoleLog(`[serverless-go-build-tools] ${prefix} ${chalk.redBright(message)}`);
      },
    };

    this.hooks = {
      'after:deploy:deploy': async () => {
        if (options.nogobuild) {
          return null;
        }
        await this.build.bind(this)();
        return this.deploy.bind(this)();
      },
      'build-go:build': this.build.bind(this),
      'deploy-go:build': this.build.bind(this),
      'deploy-go:deploy': this.deploy.bind(this),
    };
  }

  s3() {
    const provider = this.serverless.getProvider('aws');
    let awsCredentials;
    let region;
    if (
      provider.cachedCredentials &&
      provider.cachedCredentials.accessKeyId &&
      provider.cachedCredentials.secretAccessKey &&
      provider.cachedCredentials.sessionToken
    ) {
      region = provider.getRegion();
      awsCredentials = {
        accessKeyId: provider.cachedCredentials.accessKeyId,
        secretAccessKey: provider.cachedCredentials.secretAccessKey,
        sessionToken: provider.cachedCredentials.sessionToken,
      };
    } else {
      region = provider.getCredentials().region;
      awsCredentials = provider.getCredentials().credentials;
    }
    return new provider.sdk.S3({
      region,
      credentials: awsCredentials,
    });
  }

  /**
   * Wrapper method for asynchronous readline call. Allows utilization of await later for a
   * synchronous prompt and response user experience.
   * From: https://stackoverflow.com/questions/12042534/node-js-synchronous-prompt/46700053#46700053
   *
   * @param message
   * @returns Promise of the resolved answer from user
   */
  async readLineAsync(message) {
    return new Promise(resolve => {
      readline.question(message, answer => {
        resolve(answer);
      });
    });
  }

  async build() {
    const goBuilds = this.serverless.service.custom.goBuilds;
    const messagePrefix = 'build-go: ';
    if (!Array.isArray(goBuilds)) {
      this.cli.warn(messagePrefix, 'No configuration ');
      return;
    }

    // Test out Go command
    try {
      execSync('go version');
    } catch (error) {
      // error: Go is not installed
      // Ask if they want to deploy Windows workspaces, as they will not work properly without Go lang
      this.cli.log(
        messagePrefix,
        'If you want to deploy Windows workspaces within Service Workbench, you must have Go lang installed before deployment. This is recommended.',
      );
      let validAnswer = false;
      while (!validAnswer) {
        /* eslint-disable no-await-in-loop */
        const response = await this.readLineAsync(
          `${messagePrefix} Do you plan on configuring and using Windows workspaces? (y/N) `,
        );
        /* eslint-enable no-await-in-loop */
        if (response.match(/^(y|Y|yes|Yes|YES)$/)) {
          // If Windows workspaces are desired, fail build
          this.cli.warn(messagePrefix, 'Failing building due to lack of Go lang. Please install Go lang.');
          readline.close();
          validAnswer = true;
          throw new Error('Go lang not installed');
        } else if (response.match(/^(n|N|no|No|NO)$/)) {
          // If Windows workspaces are not desired, log another warning and do not fail build
          this.cli.warn(
            messagePrefix,
            'Any Windows workspaces deployed will not function properly until Go is installed and SWB is redeployed. You have been warned.',
          );
          validAnswer = true;
          readline.close();
          break;
        }
      }
    } finally {
      // Close readline to resume no matter what happened above
      readline.close();
    }

    const builds = await Promise.all(
      _.map(goBuilds, goBuild => {
        const {
          name,
          packagePath,
          sourceDirectory = './',
          outputPrefix = 'bin/',
          buildOptions = '',
          architectures = ['amd64'],
          operatingSystems = ['linux', 'darwin'],
          ...destination
        } = goBuild;

        if (!packagePath) {
          throw new Error('No package specified for go build');
        }

        if (!name) {
          throw new Error('No name specified for go build');
        }

        this.cli.log(messagePrefix, `Building package '${name}' in '${packagePath}`);

        const successfulBuilds = _.flatMap(architectures, arch => {
          return _.map(operatingSystems, os => {
            const suffix = os === 'windows' ? '.exe' : '';
            const output = `${outputPrefix}${os}-${arch}${suffix}`;
            this.cli.log(messagePrefix, `Building ${output}`);
            try {
              execSync(`go build ${buildOptions} -o ${output} ${sourceDirectory}`, {
                cwd: packagePath,
                env: { ...process.env, GOOS: os, GOARCH: arch },
                shell: process.env.SHELL,
              });
              return output;
            } catch (error) {
              // If the error status is 127, it is due to a missing shell command
              if (error.status === 127) {
                // Don't fail the build if the user doesn't have Go installed (error was handled above)
                this.cli.warn(messagePrefix, `Error building ${output}: ${error}`);
                return null;
              }
              // If the build errored for another reason, fail build as something is wrong
              this.cli.warn(messagePrefix, `Error building ${output}: ${error}`);
              throw new Error(error);
            }
            // Remove any build errors from the successfulBuilds array
          }).filter(x => x);
        });
        return { name, packagePath, successfulBuilds, ...destination };
      }),
    );

    this.serverless.variables.successfulGoBuilds = builds;
    this.cli.log(messagePrefix, `Finished builds: ${_.map(builds, build => build.name).join(', ')}`);
  }

  async deploy() {
    const goBuilds = this.serverless.variables.successfulGoBuilds;
    const messagePrefix = 'deploy-go: ';

    const s3 = this.s3();

    // eslint-disable-next-line no-restricted-syntax
    for (const goBuild of goBuilds) {
      const { name, packagePath, successfulBuilds, destinationBucket, destinationPrefix } = goBuild;

      // eslint-disable-next-line no-restricted-syntax
      for (const build of successfulBuilds) {
        const localPath = path.join(packagePath, build);
        const s3Prefix = destinationPrefix.endsWith('/')
          ? `${destinationPrefix}${build}`
          : `${destinationPrefix}/${build}`;
        this.cli.log(messagePrefix, `Uploading ${localPath} from ${name} to s3://${destinationBucket}/${s3Prefix}`);
        const stream = createReadStream(localPath);
        // eslint-disable-next-line no-await-in-loop
        await s3
          .upload(
            {
              Bucket: destinationBucket,
              Key: s3Prefix,
              Body: stream,
            },
            { partSize: 5 * 1024 * 1024, queueSize: 5 },
          )
          .promise();
      }
    }

    this.cli.log(messagePrefix, `Finished deployment`);
  }
}

module.exports = GoBuildTools;
module.exports = GoBuildTools;
