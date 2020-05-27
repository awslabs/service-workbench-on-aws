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

const Boom = require('./boom');

/**
 * This is the base class for any services you write. Here are a few examples of services that extend Service:
 * ```
 * // For a service that does not depend on other services and
 * // does not need any initialization logic and has one method named "doSomething":
 * class SimpleService extends Service {
 *   doSomething() {
 *     // add logic here
 *   }
 * }
 *
 * // A more realistic example:
 * class MyService extends Service {
 *   constructor() {
 *     super(); // don't forget to call the super class
 *
 *     this.dependency(['ns:user', 'ns:aws', 'ns:cache']);
 *     // you are declaring dependency on the user, aws and cache services.
 *     // do not add any initialization logic here, instead you should add your initialization logic in
 *     // the 'init()' method.
 *   }
 *
 *   async init() {
 *     await super.init(); // don't forget to call the super class
 *     const [ user, aws, cache ] = await this.service([ 'user', 'aws', 'cache']);
 *
 *     // you can access a setting like this:
 *     const vpcId = this.settings.get('vpc.id');
 *
 *     // to log a message
 *     this.log.info('This is the init() method of my service');
 *
 *     // do whatever you need using the user, aws, cache
 *     this.log.info(`My name is ${user.getName()}`);
 *   }
 * }
 * ```
 */
class Service {
  /**
   * In general, you want to override the constructor to declare the service dependency by calling `dependency()` from within
   * the constructor method.  However, any other initialization logic should go to the `init()` method.
   * So, keep the following in mind:
   * - You don't have access to any services in the constructor, if you need access to the services
   * then move your logic to the `init()` method.
   * - You must call the `super()` constructor.
   *
   * For example:
   * ```
   * class MyService extends AnotherService {
   *   constructor() {
   *     super(); // don't forget to call the super class
   *
   *     this.dependency(['user', 'aws', 'cache']);
   *     // you are declaring dependency on the user, aws and cache services.
   *   }
   *
   *   async init() {
   *     await super.init(); // don't forget to call the super class
   *     const [ user, aws, cache ] = await this.service(['user', 'aws', 'cache']);
   *
   *     // now do whatever you need using the user, aws, cache
   *     this.log.info(`My name is ${user.getName()}`);
   *   }
   * }
   * ```
   */
  constructor() {
    this._deps = {};
    this._optionalDeps = {};
    this._boom = new Boom();
    this.initialized = false;
    this.initializationPromise = undefined;
    // some internal instance variables that are used by the base service class
    // this.serviceName
    // this.container
  }

  // Do not override this function, instead override the 'init' function
  async initService(container, { name }) {
    // eslint-disable-line consistent-return
    this.serviceName = name;
    this.container = container;

    // Guard against a reentry
    // This could happen if service A has a method M and in that method we get service B
    // for the first time. If service X does Promise.all with many promises calling service A with method M,
    // then this results in calling service B init method as many times as the number of promises.
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      if (name !== 'settings' && name !== 'log') {
        this._settings = await this.container.find('settings');
        this._log = await this.container.find('log');
      }

      await this.init();
      this.initialized = true;

      return this;
    })();

    return this.initializationPromise;
  }

  get deps() {
    return { ...this._deps };
  }

  get optionalDeps() {
    return { ...this._optionalDeps };
  }

  /**
   * Override this method to include your initialization code. Keep in mind that this method is async.
   */
  async init() {
    // override this method to add your own logic
  }

  /**
   * Gives you access to the boom helper object. You can use this helper to return exceptions that follow
   * the error handling micro pattern.
   *
   * There are a few things you can do with this helper:
   * - You can use one of the existing methods to throw a boom error. There are four built-in error-code based methods:
   *   - `throw this.boom.badRequest('Your internal message goes here');`
   *   - `throw this.boom.forbidden('Your internal message goes here');`
   *   - `throw this.boom.notFound('Your internal message goes here');`
   *   - `throw this.boom.badImplementation('Your internal message goes here');`
   * - If your service needs to use a different error-code based method, you can extend boom in the service constructor and,
   * then, use the newly introduced error-code based method anywhere in your service.  Let's look at an example:
   *
   * ```
   * class MyService extends Service {
   *   constructor() {
   *     super();
   *     this.boom.extend(['dbError', 500], ['snsError', 500]);
   *   }
   *
   *   doSomething() {
   *     throw this.boom.dbError('database is snoozing');
   *     // throw this.boom.snsError('sns is out of whack');
   *   }
   * }
   * ```
   */
  get boom() {
    return this._boom;
  }

  /**
   * Gives you access to the settings service. For example:
   * ```
   * const vpcId = this.settings.get('vpc.id');
   * ```
   */
  get settings() {
    if (!this.initializationPromise)
      throw new Error('You tried to reference "settings" in a service but the service has not been initialized.');
    return this._settings;
  }

  /**
   * Gives you access to the log service. For example:
   * ```
   * this.log.info('sweet!);
   * ```
   */
  get log() {
    if (!this.initializationPromise)
      throw new Error('You tried to reference "log" in a service but the service has not been initialized.');
    return this._log;
  }

  _enforce(source = {}, target = []) {
    const normalized = _.concat(target);
    _.forEach(normalized, name => {
      if (this.container.isRoot(name)) return;
      if (!source[name])
        throw new Error(
          `The service "${this.serviceName}" tried to access the "${name}" service, but it was not declared as a dependency.`,
        );
    });
  }

  /**
   * Gain access to a service or services. If you try to access a service that you did not declare as a dependency,
   * an error is thrown.
   *
   * An example of accessing a service:
   * ```
   * const [user, aws, cache] = await this.service(['ns:user', 'ns:aws', 'ns:cache']);
   * const account = await this.service('ns:account);
   * ```
   *
   * @param {string | Array<string>} nameOrNames the name of the service(s) you need access to
   */
  async service(nameOrNames) {
    if (!this.initializationPromise)
      throw new Error('You tried to use "service()" in a service but the service has not been initialized.');
    this._enforce(this._deps, nameOrNames);
    const result = await Promise.all(
      _.concat(nameOrNames).map(async name => {
        const service = await this.container.find(name); // eslint-disable-line no-await-in-loop
        if (!service)
          throw new Error(
            `The service "${this.serviceName}" tried to access the "${name}" service, but the "${name}" service was not registered.`,
          );
        return service;
      }),
    );

    if (!_.isArray(nameOrNames)) return _.head(result);
    return result;
  }

  /**
   * Gain access to a service or services. If you try to access a service that you did not declare as an optional dependency,
   * an error is thrown.  However, if the service itself is not registered, then `undefined` is returned.
   *
   * An example of accessing a service:
   * ```
   * const [user, aws, cache] = await this.optionalService(['ns:user', 'ns:aws', 'ns:cache']);
   * const account = await this.optionalService('ns:account);
   * ```
   *
   * @param {string | Array<string>} nameOrNames the name of the service(s) you need access to
   */
  async optionalService(nameOrNames) {
    if (!this.initializationPromise)
      throw new Error('You tried to use "optionalService()" in a service but the service has not been initialized.');
    this._enforce(this._optionalDeps, nameOrNames);
    const result = Promise.all(
      _.concat(nameOrNames).map(async name => {
        const service = await this.container.find(name); // eslint-disable-line no-await-in-loop
        return service;
      }),
    );

    if (!_.isArray(nameOrNames)) return _.head(result);
    return result;
  }

  /**
   * Use this method to declare dependency on other services. Call this method inside the constructor of your service.<br/>
   * For example:
   * ```
   * class MyService extends AnotherService {
   *   constructor() {
   *     super(); // important: don't forget to call the constructor of the super class
   *
   *     this.dependency(['ns:user', 'ns:account', 'ns:cache']);
   *     // you are declaring dependency on the user, account and cache services.
   *     // where 'ns' is a string representing the namespace of the service.
   *
   *     // if you just have one dependency
   *     this.dependency('ns:user');
   *   }
   * }
   * ```
   *
   * *NOTE*: You can call `dependency()` anytime before the service is initialized, once the service is initialized, calling
   * `dependency()` will throw an exception.
   *
   * @param {string | Array<string> } deps The dependency name(s), see the description for examples.
   */
  dependency(deps = []) {
    if (this.initialized)
      throw new Error(
        `You are trying to add dependency to the "${this.serviceName}" service, but the service has already been initialized.`,
      );
    const arr = _.concat(deps); // this allows us to receive either one string or an array of strings
    if (_.isEmpty(arr)) throw new Error('You are trying to add an empty dependency to a service.');
    _.forEach(arr, item => {
      if (_.isEmpty(item))
        throw new Error('You tried to call "dependency()" in a service but you included an empty string.');
      if (!_.isString(item))
        throw new Error('You tried to call "dependency()" in a service but you included an item that is not a string.');
      this._deps[item] = true;
    });
  }

  /**
   * Use this method to declare optional dependency on other services. Call this method inside the constructor of your service.<br/>
   * For example:
   * ```
   * class MyService extends AnotherService {
   *   constructor() {
   *     super(); // important: don't forget to call the constructor of the super class
   *
   *     this.optionalDependency(['ns:user', 'ns:account', 'ns:cache']);
   *     // you are declaring optional dependency on the user, account and cache services.
   *     // where 'ns' is a string representing the namespace of the service.
   *
   *     // if you just have one dependency
   *     this.optionalDependency('ns:user');
   *   }
   * }
   * ```
   *
   * *NOTE*: You can call `optionalDependency()` anytime before the service is initialized, once the service is initialized, calling
   * `optionalDependency()` will throw an exception.
   *
   * Once you declare a dependency, you can use gain access to it using 'optionalService()'
   *
   * @param {string | Array<string> } deps The optional dependency name(s), see the description for examples.
   */
  optionalDependency(deps = []) {
    if (this.initialized)
      throw new Error(
        `You are trying to add optional dependency to the "${this.serviceName}" service, but the service has already been initialized.`,
      );
    const arr = _.concat(deps); // this allows us to receive either one string or an array of strings
    if (_.isEmpty(arr)) throw new Error('You are trying to add an empty optional dependency to a service.');
    _.forEach(arr, item => {
      if (_.isEmpty(item))
        throw new Error('You tried to call "optionalDependency()" in a service but you included an empty string.');
      if (!_.isString(item))
        throw new Error(
          'You tried to call "optionalDependency()" in a service but you included an item that is not a string.',
        );
      this._optionalDeps[item] = true;
    });
  }
}

module.exports = Service;
