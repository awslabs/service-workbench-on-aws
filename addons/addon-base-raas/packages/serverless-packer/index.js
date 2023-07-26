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

const execFileSync = require('child_process').execFileSync;

const fs = require('fs');
const _ = require('lodash');
const { runCommand } = require('./lib/utils/command');

const PACKER_FILE_DIR = './config/infra';

class ServerlessPackerPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    // Add the version information to the stage file if it is not already there
    // This is for the case when machine images are build before the environment is deployed
    this.addVersionInfo(this.options.stage);

    this.commands = {
      'build-image': {
        usage: 'Build an AMI using packer',
        lifecycleEvents: ['build', 'add-imds-v2-support'],
        options: {
          files: {
            usage:
              'Override the packer file used to build the AMI' +
              '(e.g. "--files \'packer.json\'" or "-m \'packer.json\'")',
            required: false,
            shortcut: 'f',
            type: 'string',
          },
        },
      },
    };

    this.hooks = {
      'build-image:build': this.buildImages.bind(this),
      'build-image:add-imds-v2-support': this.addIMDSv2Support.bind(this),
    };
  }

  async buildImages() {
    let filePaths;
    if (this.options.files) {
      // Parse files passed via CLI arg
      filePaths = this.options.files.split(',');
    } else {
      // Look for files in default location
      filePaths = await this.getPackerFiles();
    }

    this.serverless.cli.log(`Building packer images: ${filePaths.join(', ')}`);
    return Promise.all(
      filePaths.map(async filePath => {
        this.serverless.cli.log(`${filePath}: Building packer image`);

        const args = _.concat('build', '-machine-readable', this.packageVarArgs(), `${PACKER_FILE_DIR}/${filePath}`);

        try {
          await runCommand({
            command: 'packer',
            args,
            stdout: {
              log: this.serverless.cli.consoleLog,
              raw: msg => {
                this.serverless.cli.log(`${filePath}: ${msg}`);
              },
              fileStream: fs.createWriteStream(`${filePath}_build.log`),
            },
          });
        } catch (err) {
          throw new Error(`${filePath}: Error running packer build command: ${err}`);
        }

        this.serverless.cli.log(`${filePath}: Finished packer image`);
      }),
    );
  }

  async addIMDSv2Support() {
    this.serverless.cli.log('Adding IMDSv2 support to AMIs');
    let filePaths;
    if (this.options.files) {
      // Parse files passed via CLI arg
      filePaths = this.options.files.split(',');
    } else {
      // Look for files in default location
      filePaths = await this.getPackerFiles();
    }
    this.serverless.cli.log(`Adding IMDSv2 support to: ${filePaths.join(', ')}`);
    // Parse AMI IDs from packer build log
    const amis = [];
    filePaths.forEach(filePath => {
      const logFile = fs.readFileSync(`${filePath}_build.log`, 'utf8');
      const amiLineIndexStart = logFile.lastIndexOf('AMIs were created');
      const amiLine = logFile.substring(amiLineIndexStart);
      const amiRegex = 'ami-[0-9a-z]{17}';
      const result = amiLine.match(amiRegex);
      amis.push(result);
    });

    // Get AWS Profile name and region from settings
    const customSettings = this.serverless.service.custom.settings;
    if (customSettings.enableAmiSharing) {
      customSettings.awsProfile = customSettings.devopsProfile;
    }
    const awsProfile = customSettings.awsProfile;
    const awsRegion = customSettings.awsRegion;

    // For each AMI, add IMDSv2 support
    return Promise.all(
      amis.map(async ami => {
        this.serverless.cli.log(`${ami}: Adding IMDSv2 support`);
        const args = _.concat(
          'ec2',
          'modify-image-attribute',
          '--image-id',
          ami,
          '--imds-support',
          'v2.0',
          '--profile',
          awsProfile,
          '--region',
          awsRegion,
        );

        try {
          await runCommand({
            command: 'aws',
            args,
            stdout: {
              log: this.serverless.cli.consoleLog,
              raw: msg => {
                this.serverless.cli.log(`${ami}: ${msg}`);
              },
            },
          });
        } catch (err) {
          throw new Error(`${ami}: Error running aws command: ${err}`);
        }
      }),
    );
  }

  async getPackerFiles() {
    return new Promise((resolve, reject) => {
      fs.readdir(PACKER_FILE_DIR, (err, files) => {
        if (err || !files) {
          return reject(new Error('Missing config/infra directory.'));
        }

        const packerFiles = [];
        files.forEach(file => {
          if (file.match('packer.*.json')) {
            packerFiles.push(file);
          }
        });
        if (packerFiles.length > 0) {
          return resolve(packerFiles);
        }

        return reject(new Error('No packer file found'));
      });
    });
  }

  packageVarArgs() {
    const customSettings = this.serverless.service.custom.settings;
    if (customSettings.enableAmiSharing) {
      customSettings.awsProfile = customSettings.devopsProfile;
    }
    const varArgs = [];
    _.forEach(customSettings, (value, key) => {
      varArgs.push('-var');
      varArgs.push(`${key}=${value}`);
    });
    return varArgs;
  }

  async addVersionInfo(stageName) {
    this.serverless.cli.log('Adding versionNumber and versionDate to stage file');

    try {
      execFileSync('./scripts/get-release-info.sh', [stageName], { cwd: '../../../' });
    } catch (err) {
      throw new Error(`Error adding versionNumber and versionDate to stage file: ${err}`);
    }
  }
}

module.exports = ServerlessPackerPlugin;
