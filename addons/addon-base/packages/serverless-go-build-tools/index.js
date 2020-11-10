const { execSync } = require('child_process');
const { createReadStream } = require('fs');
const path = require('path');
const _ = require('lodash');
const chalk = require('chalk');

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

  async build() {
    const goBuilds = this.serverless.service.custom.goBuilds;
    const messagePrefix = 'build-go: ';
    if (!Array.isArray(goBuilds)) {
      this.cli.warn(messagePrefix, 'No configuration ');
      return;
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
              // Don't fail the build if the user doesn't have go installed
              this.cli.warn(messagePrefix, `Error building ${output}: ${error}`);
              return null;
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
