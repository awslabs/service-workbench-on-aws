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
