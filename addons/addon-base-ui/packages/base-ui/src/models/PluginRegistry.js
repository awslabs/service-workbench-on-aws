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
