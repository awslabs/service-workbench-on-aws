import _ from 'lodash';
import { observable } from 'mobx';

import { PluginRegistry } from '../models/PluginRegistry';

const appContext = observable({});

/**
 * Initializes the given appContext (application context containing various MobX stores etc) by calling each plugin's
 * "registerAppContextItems" and "postRegisterAppContextItems" methods.
 *
 * @param {Object} pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 * Each 'contextItems' plugin in the returned array is an object containing "registerAppContextItems" and "postRegisterAppContextItems" plugin methods.
 *
 * @returns {{intervalIds: {}, disposers: {}, pluginRegistry: {}}}
 */
const initializeAppContext = pluginRegistry => {
  const registry = new PluginRegistry(pluginRegistry);
  const appContextHolder = {
    disposers: {},
    intervalIds: {},
    pluginRegistry: registry,
    assets: {
      images: {},
    },
  };

  const registerAppContextItems = registry.getPluginsWithMethod('app-context-items', 'registerAppContextItems');
  _.forEach(registerAppContextItems, plugin => {
    plugin.registerAppContextItems(appContextHolder);
  });

  const postRegisterAppContextItems = registry.getPluginsWithMethod('app-context-items', 'postRegisterAppContextItems');
  _.forEach(postRegisterAppContextItems, plugin => {
    plugin.postRegisterAppContextItems(appContextHolder);
  });

  Object.assign(appContext, appContextHolder); // this is to ensure that it is the same appContext reference whether initializeAppContext is called or not
  return appContextHolder;
};

export { appContext, initializeAppContext };
