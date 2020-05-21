const fs = require('fs');
const _ = require('lodash');
const { runCommand } = require('./lib/utils/command.js');

const PACKER_FILE_DIR = './config/infra';

class ServerlessPackerPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.commands = {
      'build-image': {
        usage: 'Build an AMI using packer',
        lifecycleEvents: ['build'],
        options: {
          file: {
            usage:
              'Override the packer file used to build the AMI' +
              '(e.g. "--file \'packer.json\'" or "-m \'packer.json\'")',
            required: false,
            shortcut: 'f',
          },
        },
      },
    };

    this.hooks = {
      'build-image:build': this.buildImages.bind(this),
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

        const args = _.concat('build', this.packageVarArgs(), `${PACKER_FILE_DIR}/${filePath}`);

        try {
          await runCommand({
            command: 'packer',
            args,
            stdout: {
              log: this.serverless.cli.consoleLog,
              raw: msg => {
                this.serverless.cli.log(`${filePath}: ${msg}`);
              },
            },
          });
        } catch (err) {
          throw new Error(`${filePath}: Error running packer build command: ${err}`);
        }

        this.serverless.cli.log(`${filePath}: Finished packer image`);
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
    const varArgs = [];
    _.forEach(this.serverless.service.custom.settings, (value, key) => {
      varArgs.push('-var');
      varArgs.push(`${key}=${value}`);
    });
    return varArgs;
  }
}

module.exports = ServerlessPackerPlugin;
