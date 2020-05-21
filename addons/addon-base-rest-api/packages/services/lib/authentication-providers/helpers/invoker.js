const resolve = require('./resolver').resolve;

function newInvoker(findServiceByName) {
  return async (locator, ...args) => {
    const resolvedLocator = resolve(locator);
    switch (resolvedLocator.type) {
      case 'service': {
        const { serviceName, methodName } = resolvedLocator;
        const instance = await findServiceByName(serviceName);
        if (!instance) {
          throw new Error(`unknown service: ${serviceName}`);
        }
        return instance[methodName].call(instance, ...args);
      }
      default:
        throw new Error(`unsupported locator type: ${resolve.type}`);
    }
  };
}

module.exports = { newInvoker };
