/* eslint-disable no-console */
const ServicesContainer = require('@aws-ee/base-services-container/lib/services-container');
const { registerServices } = require('@aws-ee/base-services/lib/utils/services-registration-util');
const { registerSteps } = require('@aws-ee/base-post-deployment/lib/steps-registration-util');

const pluginRegistry = require('./plugins/plugin-registry');

async function handler(_event, _context) {
  // eslint-disable-line no-unused-vars
  // register services
  const container = new ServicesContainer(['settings', 'log']);
  // registerServices - Registers services by calling each service registration plugin in order.
  await registerServices(container, pluginRegistry);

  // registerSteps - Registers post deployment steps by calling each step registration plugin in order.
  const stepsMap = await registerSteps(container, pluginRegistry);
  await container.initServices();

  const log = await container.find('log');

  try {
    log.info('Post deployment -- STARTED');
    const entries = Array.from(stepsMap);
    // We need to await execution of steps in the strict sequence so awaiting in loop
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const name = entry[0]; // entry is [stepServiceName, serviceImpl]
      const service = await container.find(name); // eslint-disable-line no-await-in-loop
      log.info(`====> Running ${name}.execute()`);
      await service.execute(); // eslint-disable-line no-await-in-loop
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */
    log.info('Post deployment -- ENDED');
  } catch (error) {
    console.log('================= Error ==================');
    console.log(JSON.stringify(error, null, 2)); // so we can print the payload of the error object (if any)
    throw error;
  }
}

module.exports.handler = handler;
