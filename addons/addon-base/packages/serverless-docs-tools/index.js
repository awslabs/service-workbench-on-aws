const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const aws = require('aws-sdk');
const chalk = require('chalk');
const shell = require('shelljs');
const chokidar = require('chokidar');

const { registerDocs } = require('@aws-ee/base-docs/lib/docs-registration-util');

const pluginRegistry = require(path.resolve('./src/plugins/plugin-registry')); // eslint-disable-line
const { runCommand } = require('./lib/utils/command.js');

// Relative directory where collated Docusaurus site source files should reside
const DIST_DIR = 'dist-autogen';

class ServerlessDocsToolsPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      'start-ui': {
        usage:
          'Serves a Documentation UI via a local development server. This command supports live reloading of files in source directories, as configured in the plugin registry',
        lifecycleEvents: ['package', 'start'],
        options: {},
      },
      'package-ui': {
        usage: 'Packages the Documentation UI, ready for deployment',
        lifecycleEvents: ['package', 'build'],
        options: {
          local: {
            usage: 'If enabled, JS/CSS bundles will not be minified.',
            default: false,
          },
        },
      },
      'deploy-ui-s3': {
        usage:
          'Deploys (via "aws s3 sync") a target directory to the bucket with name configured via the `s3BucketName` variable',
        lifecycleEvents: ['package', 'deploy-s3', 'invalidate-cache'],
        options: {
          'invalidate-cache': {
            usage:
              'If enabled, invalidates a CloudFront distribution after deploying (only if the contents of the `s3BucketName` bucket were modified). Requires a `s3CloudFrontDistributionId` variable to be specified.',
            default: false,
          },
        },
      },
      'deploy-ui-ghp': {
        usage: `This command deploys artifacts as a Github Pages site. It first builds the Docusaurus site at \`${DIST_DIR}\` (writing built artifacts to \`${DIST_DIR}/build\`). Then, it creates a commit containing only these built artifacts and pushes it to the configured Git branch (creating one if it doesn't already exist).`,
        lifecycleEvents: ['package', 'deploy-ghp'],
        options: {},
      },
      'create-snapshot-ui': {
        usage: 'This command creates a new Docusaurus version snapshot with the provided version string',
        lifecycleEvents: ['create-snapshot'],
        options: {
          tag: {
            usage: 'Version identifier to tag the snapshot with (e.g. "1.0.0")',
            required: true,
          },
        },
      },
    };

    this.hooks = {
      'start-ui:package': this.package.bind(this),
      'start-ui:start': this.start.bind(this),

      'package-ui:package': this.package.bind(this),
      'package-ui:build': this.build.bind(this),

      'deploy-ui-s3:package': this.package.bind(this),
      'deploy-ui-s3:deploy-s3': this.deployS3.bind(this),
      'deploy-ui-s3:invalidate-cache': this.invalidateCache.bind(this),

      'deploy-ui-ghp:package': this.package.bind(this),
      'deploy-ui-ghp:deploy-ghp': this.deployGhp.bind(this),

      'create-snapshot-ui:create-snapshot': this.createSnapshot.bind(this),
    };

    this.cli = {
      raw(message) {
        serverless.cli.consoleLog(chalk.dim(message));
      },
      log(message) {
        serverless.cli.consoleLog(`[serverless-docs-tools] ${chalk.yellowBright(message)}`);
      },
    };
  }

  async start() {
    const docsConfig = await this._readDocsConfig();

    // Watch for and sync any changes to pages and static directories
    this._watchAndSyncInputDirectories(docsConfig.pagesPaths, `${DIST_DIR}/docs`);
    this._watchAndSyncInputDirectories(docsConfig.staticFilesPaths, `${DIST_DIR}/static`);

    // Run Docusaurus local server
    await runCommand({
      command: 'pnpx',
      args: ['docusaurus', 'start', '--port', '3001'],
      cwd: DIST_DIR,
      stdout: {
        log: this.cli.log,
        raw: msg => this.cli.raw(msg),
      },
    });
  }

  async package() {
    const docsConfig = await this._readDocsConfig();

    // Sync registered input directories with `DIST_DIR`
    await this._syncInputDirectories(docsConfig.pagesPaths, `${DIST_DIR}/docs`);
    await this._syncInputDirectories(docsConfig.staticFilesPaths, `${DIST_DIR}/static`);

    // Write config files
    this._writeSidebarsConfig(docsConfig.sidebarsConfig);
    this._writeDocusaurusConfig(docsConfig.docusaurusConfig);

    // Ensure files are formatted correctly
    await runCommand({
      command: 'pnpm',
      args: ['run', 'format'],
      cwd: DIST_DIR,
      stdout: {
        log: this.cli.log,
        raw: () => {}, // no-op to suppress output
      },
    });
  }

  async build() {
    const isLocal = this.options.local;

    await runCommand({
      command: 'pnpx',
      args: ['docusaurus', 'build', '--out-dir', 'build', isLocal ? '--no-minify' : ''],
      cwd: DIST_DIR,
      stdout: {
        log: this.cli.log,
        raw: msg => this.cli.raw(msg),
      },
    });

    this.cli.log(`UI built successfully and written to "${DIST_DIR}/build"`);
  }

  async deployS3() {
    const bucketName = this.serverless.service.custom.settings.s3BucketName;
    const buildDir = `${DIST_DIR}/build/`;
    this.cli.log(`Deploying UI in "${path.resolve(buildDir)}" to ${bucketName} S3 bucket...`);

    this.mutatedBucket = false;
    const awsProfile = this.serverless.service.custom.settings.awsProfile;
    const args = [
      's3',
      'sync',
      buildDir,
      // Write to docs/ prefix as we assume the CloudFront distribution has multiple S3
      // origins, and the docs website will be accessible from /docs
      `s3://${bucketName}/docs`,
      '--delete',
      '--region',
      this.serverless.service.custom.settings.awsRegion,
    ];
    if (awsProfile) {
      args.push('--profile', awsProfile);
    }
    await runCommand({
      command: 'aws',
      args,
      stdout: {
        log: this.cli.log,
        raw: msg => {
          this.mutatedBucket = true; // If external command outputs to stdout.raw then we probably mutated the bucket
          this.cli.raw(msg);
        },
      },
    });
  }

  async invalidateCache() {
    const distributionId = this.serverless.service.custom.settings.s3CloudFrontDistributionId;
    const shouldInvalidate = this.options['invalidate-cache'];
    if (shouldInvalidate && !distributionId) {
      throw Error('You specified "--invalidate-cache", but `s3CloudFrontDistributionId` setting was not found');
    }

    if (shouldInvalidate && this.mutatedBucket) {
      this.cli.log('Invalidating CloudFront distribution cache...');
      const sdk = this._getCloudFrontSdk();

      try {
        const invalidation = await sdk
          .createInvalidation({
            DistributionId: distributionId,
            InvalidationBatch: {
              CallerReference: Date.now().toString(),
              Paths: {
                Quantity: 1,
                Items: ['/*'], // Invalidate all files
              },
            },
          })
          .promise();

        this.cli.log(
          `Created new CloudFront invalidation: id=${invalidation.Invalidation.Id}, status=${invalidation.Invalidation.Status}, paths="/*"`,
        );
      } catch (err) {
        throw new Error(`Error invalidating CloudFront ${distributionId} cache: ${err}`);
      }
    }

    if (this.mutatedBucket) {
      this.cli.log('UI deployed successfully');
    } else {
      this.cli.log('Nothing new to deploy. Did you forget to call "package-ui"? Skipping deployment...');
    }
  }

  async deployGhp() {
    this.cli.log(`Building and deploying UI in "${path.resolve(DIST_DIR)}" via Github Pages...`);

    const { ghpGitUser, ghpUseSsh, ghpDeploymentBranch, ghpCurrentBranch } = this.serverless.service.custom.settings;
    if (!ghpGitUser) {
      // eslint-disable-next-line
      throw new Error('${self:custom.settings.ghpGitUser} must be provided');
    }

    const env = {
      GIT_USER: ghpGitUser,
      USE_SSH: Boolean(ghpUseSsh),
      ...(ghpDeploymentBranch && { DEPLOYMENT_BRANCH: ghpDeploymentBranch }),
      ...(ghpCurrentBranch && { CURRENT_BRANCH: ghpCurrentBranch }),
    };
    await runCommand({
      command: 'pnpx',
      args: ['docusaurus', 'deploy'],
      cwd: DIST_DIR,
      env,
      stdout: {
        log: this.cli.log,
        raw: msg => this.cli.raw(msg),
      },
    });
  }

  async createSnapshot() {
    const { tag } = this.options;
    this.cli.log(`Creating snapshot with tag ${tag}...`);
    await runCommand({
      command: 'pnpx',
      args: ['docusaurus', 'docs:version', tag],
      cwd: DIST_DIR,
      stdout: {
        log: this.cli.log,
        raw: msg => this.cli.raw(msg),
      },
    });
  }

  async _readDocsConfig() {
    this.cli.log('Reading docs config from plugin registry...');
    const docsConfig = await registerDocs(pluginRegistry);
    return docsConfig;
  }

  async _syncInputDirectories(srcDirs, dstDir) {
    const absDstDir = path.resolve(dstDir);
    this.cli.log(`Removing all contents of "${dstDir}"...`);
    shell.rm('-rf', dstDir);

    this.cli.log(`Writing contents of ["${srcDirs.join('", "')}"] to "${absDstDir}"...`);

    // Copy pages paths and static files paths
    shell.mkdir('-p', dstDir);
    srcDirs.forEach(srcDir => {
      shell.cp('-R', `${srcDir}/*`, dstDir);
    });
  }

  async _watchAndSyncInputDirectories(srcDirs, dstDir) {
    const absDstDir = path.resolve(dstDir);
    this.cli.log(`Syncing all changes to ["${srcDirs.join('", "')}"] with "${absDstDir}"...`);

    const watcher = chokidar.watch(srcDirs, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('all', (event, srcPathAbs) => {
      const fsEvents = ['add', 'change', 'unlink', 'addDir', 'unlinkDir'];
      if (!fsEvents.includes(event)) {
        // Ignore events unrelated to files/directories
        return;
      }

      const srcPathAbsPrefix = srcDirs.find(srcDir => srcPathAbs.startsWith(srcDir));
      const srcPathRelative = srcPathAbs.replace(srcPathAbsPrefix, '');
      const dstPathRelative = `${dstDir}${srcPathRelative}`;

      switch (event) {
        case 'add':
        case 'change':
        case 'addDir': {
          this.cli.log(`File change detected. Copying "${srcPathAbs}" to "${path.resolve(dstPathRelative)}"...`);
          shell.cp('-r', srcPathAbs, dstPathRelative);
          break;
        }
        case 'unlink':
        case 'unlinkDir': {
          this.cli.log(`File change detected. Removing "${path.resolve(dstPathRelative)}"...`);
          shell.rm('-rf', dstPathRelative);
          break;
        }
        default:
      }
    });
  }

  _writeDocusaurusConfig(docusaurusConfig) {
    this.cli.log(`Writing "${DIST_DIR}/docusaurus.config.js"...`);

    const enrichedDocusaurusConfig = _.set(
      _.set(
        docusaurusConfig,
        // Add sidebarPath to config
        'presets[0][1].docs.sidebarPath',
        require.resolve(path.resolve(`${DIST_DIR}/sidebars.json`)),
      ),
      // Add customCss to config
      'presets[0][1].theme.customCss',
      require.resolve(path.resolve(`${DIST_DIR}/custom.css`)),
    );
    fs.writeFileSync(
      `${DIST_DIR}/docusaurus.config.js`,
      `module.exports = ${JSON.stringify(enrichedDocusaurusConfig, null, 2)}`,
    );
  }

  _writeSidebarsConfig(sidebarsConfig) {
    this.cli.log(`Writing "${DIST_DIR}/sidebars.json"...`);

    fs.writeFileSync(`${DIST_DIR}/sidebars.json`, JSON.stringify(sidebarsConfig, null, 2));
  }

  _getCloudFrontSdk() {
    const profile = this.serverless.service.custom.settings.awsProfile;
    const region = this.serverless.service.custom.settings.awsRegion;

    aws.config.update({
      maxRetries: 3,
      region,
      sslEnabled: true,
    });

    // If a an AWS SDK profile has been configured, use its credentials
    if (profile) {
      const credentials = new aws.SharedIniFileCredentials({ profile });
      aws.config.update({ credentials });
    }
    return new aws.CloudFront();
  }
}

module.exports = ServerlessDocsToolsPlugin;
