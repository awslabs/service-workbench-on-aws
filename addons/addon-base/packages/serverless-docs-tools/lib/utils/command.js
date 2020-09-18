/**
 * Helpers for executing an external command.
 * */
const _ = require('lodash');
const chalk = require('chalk');
const spawn = require('cross-spawn');

// to help avoid unleashing Zalgo see http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony
const callLater = (callback, ...args) => {
  setImmediate(() => {
    callback(...args);
  });
};

const runCommand = ({ command, args, successCodes = [0], cwd, env, stdout }) => {
  const child = spawn(command, args, { stdio: 'pipe', env: { ...process.env, ...env }, cwd });
  stdout.log(`${chalk.bgGreen('>>')} ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    // we are using _.once() because the error and exit events might be fired one after the other
    // see https://nodejs.org/api/child_process.html#child_process_event_error
    const rejectOnce = _.once(reject);
    const resolveOnce = _.once(resolve);
    const errors = [];

    child.stdout.on('data', data => {
      stdout.raw(data);
    });

    child.stderr.on('data', data => {
      errors.push(data.toString().trim());
    });

    child.on('exit', code => {
      if (successCodes.includes(code)) {
        callLater(resolveOnce);
      } else {
        callLater(rejectOnce, new Error(`process exited with code ${code}: ${errors.join('\n')}`));
      }
    });
    child.on('error', () => callLater(rejectOnce, new Error('Failed to start child process.')));
  });
};

module.exports = { runCommand };
