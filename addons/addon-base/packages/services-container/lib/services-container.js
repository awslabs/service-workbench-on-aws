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

const _ = require('lodash');
const toposort = require('toposort');

/**
 * First of all, a services container has nothing to do with Docker.
 *
 * A services container is simply an instance of a JavaScript class that runs inside a node.js unix process.
 *
 * It is a container of services that has two main responsibilities:
 * - A registry for the Service class instances.
 * - Initializing the services on demand.
 *
 * This is a low level class that you usually do not interact with directly with the exception of calling
 * the `register()` method. Higher level abstractions, such as the API Framework and the Service class, hide most of the
 * interactions with this class from the rest of your service classes.
 *
 * **Usage**
 *
 * ![Services Container Usage](images/services-container-usage.jpg)
 */
class ServicesContainer {
  /**
   * @param {Array<string>} roots An array listing all of the root dependencies that are automatically added to all the services.
   *
   * An example:
   *
   * ```
   * const container = new ServicesContainer(['settings', 'log']);
   * ```
   */
  constructor(roots = []) {
    this.roots = {};
    _.forEach(roots, (item) => {
      this.roots[item] = true;
    });

    // this shape of the serviceMap is:
    // {
    //   '<serviceName1>': { lazy: true (default), instance },
    //   ...
    //  }
    this.serviceMap = {};
    this.initialized = false;
  }

  isRoot(name) {
    return !!this.roots[name];
  }

  /**
   * Register a service with the container.
   *
   * @param {string} name The name of the service to register
   * @param {Service} instance The instance of the service to register
   * @param {Object} [options] An object containing the option values
   * @param {boolean} [options.lazy=true] True if the service should be initialized lazily
   *
   *
   * An example:
   *
   * ```
   * container.register('user', <user service class instance>, { lazy: false });
   * ```
   */
  register(name, instance, options = {}) {
    const ops = { lazy: true, ...options, instance };
    if (this.initialized)
      throw new Error(
        `You tried to register a service "${name}" after the service initialization stage had completed.`,
      );
    if (_.isEmpty(name)) throw new Error('You tried to register a service, but you did not provide a name.');
    if (!_.isObject(instance))
      throw new Error(
        `You tried to register a service named "${name}", but you didn't provide an instance of the service.`,
      );

    // don't add a root service to itself otherwise we will be creating a cyclic dependency
    // also, root dependencies can not depend on each other.
    if (!this.roots[name]) {
      // we add all the root dependencies to the service
      _.forEach(this.roots, (_ignore, rootName) => {
        if (instance.deps[rootName] || instance.optionalDeps[rootName]) return;
        instance.dependency(rootName);
      });
    }

    this.serviceMap[name] = ops;
  }

  /**
   * Initialize the services that are marked with lazy = false.
   */
  async initServices() {
    this.initialized = true;
    this.validate();
    const names = _.keys(this.serviceMap);
    const services = [];
    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const name of names) {
      const meta = this.serviceMap[name];
      const found = !!meta;
      if (!found)
        throw new Error(`The service container could not be initialized because the "${name}" service does not exist`);

      const instance = meta.instance;
      if (found && !meta.lazy) {
        if (!instance.initialized) await instance.initService(this, { name }); // eslint-disable-line no-await-in-loop
        services.push({ name, instance });
      }
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */

    return services;
  }

  /**
   * Gain access to a service. Returns `undefined` if the service is not found. Throws an exception if you call `find` before the `initServices` was called.
   *
   * An example:
   * ```
   * const userService = await container.find('ns:user);
   * ```
   *
   * @param {string} name The name of the service that you want to lookup and gain access to.
   */
  async find(name) {
    if (!this.initialized) throw new Error('You tried to call find() before the service container was initialized.');
    const meta = this.serviceMap[name];
    if (!meta) return undefined;
    const instance = meta.instance;
    if (instance.initialized) return instance;
    await instance.initService(this, { name });

    return instance;
  }

  /**
   * Validates that there is no circular dependencies and returns a list of service names sorted according to the dependency order.
   * - Throws an exception if there is a circular dependency.
   * - Throws an exception if a dependency is missing (not applicable for optional dependencies)
   *
   * An example:
   * ```
   * const list = container.validate();
   * // list might contain elements as follows:
   * // [ 'settings', 'user ]
   * ```
   */
  validate() {
    const edges = [];

    _.forEach(this.serviceMap, (meta, serviceName) => {
      const instance = meta.instance;
      _.forEach(instance.deps, (_ignore, name) => {
        const child = this.serviceMap[name];
        if (!child)
          throw new Error(
            `The "${serviceName}" service has a dependency on the "${name}" service. But the "${name}" service was not registered.`,
          );
        edges.push([serviceName, name]);
      });
      _.forEach(instance.optionalDeps, (_ignore, name) => {
        const child = this.serviceMap[name];
        if (!child) return;
        edges.push([serviceName, name]);
      });
    });

    const ordered = toposort(edges).reverse();
    return ordered;
  }
}

module.exports = ServicesContainer;
