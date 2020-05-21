/* eslint-disable import/prefer-default-export */
import _ from 'lodash';
import { processSequentially } from '../helpers/utils';

class PluginRegistry {
  constructor(registry) {
    this.registry = registry;
  }

  getPlugins(extensionPoint) {
    return this.registry.getPlugins(extensionPoint);
  }

  getPluginsWithMethod(extensionPoint, methodName) {
    const registry = this.registry;
    const plugins = registry.getPlugins(extensionPoint);
    return _.filter(plugins, plugin => _.isFunction(plugin[methodName]));
  }

  async runPlugins(extensionPoint, methodName, ...args) {
    const plugins = this.getPluginsWithMethod(extensionPoint, methodName);

    // Each plugin needs to be executed in order. The plugin method may be return a promise we need to await
    // it in sequence.
    return processSequentially(plugins, plugin => plugin[methodName](...args));
  }
}

export { PluginRegistry };
