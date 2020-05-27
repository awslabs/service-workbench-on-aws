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

/**
 * Helpers for executing an external command.
 * */
const _ = require('lodash');
const chalk = require('chalk');
const spawn = require('cross-spawn');

const runCommand = ({ command, args, successCodes = [0], cwd, stdout }) => {
  const child = spawn(command, args, { stdio: 'pipe', cwd });
  stdout.log(`${chalk.bgGreen('>>')} ${command} ${args.join(' ')}`);
  return new Promise((resolve, reject) => {
    // we are using _.once() because the error and exit events might be fired one after the other
    // see https://nodejs.org/api/child_process.html#child_process_event_error
    const rejectOnce = _.once(reject);
    const resolveOnce = _.once(resolve);
    const errors = [];

    child.stdout.on('data', (data) => {
      stdout.raw(data.toString().trim());
    });

    child.stderr.on('data', (data) => {
      errors.push(data.toString().trim());
    });

    child.on('exit', (code) => {
      if (successCodes.includes(code)) {
        callLater(resolveOnce);
      } else {
        callLater(rejectOnce, new Error(`process exited with code ${code}: ${errors.join('\n')}`));
      }
    });
    child.on('error', () => callLater(rejectOnce, new Error('Failed to start child process.')));
  });
};

// to help avoid unleashing Zalgo see http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony
const callLater = (callback, ...args) => {
  setImmediate(() => {
    callback(...args);
  });
};

module.exports = { runCommand };
