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
const Service = require('@aws-ee/base-services-container/lib/service');

const { isDeny, deny } = require('./authorization-utils');

/**
 * Main authorization service implementation that performs authorization for the specified "action" by calling all the
 * available plugins from various add-ons for the specified authorization extension point. These plugins are expected to
 * implement "authorize" method.
 */
class AuthorizationService extends Service {
  constructor() {
    super();
    this.dependency(['pluginRegistryService']);
  }

  /**
   * Main authorization method responsible for authorizing the specified action.
   *
   * @param requestContext The request context object containing principal (caller) information.
   * The principal's identifier object is expected to be available as "requestContext.principalIdentifier" and the
   * principal object is expected to be available as "requestContext.principal"
   *
   * @param extensionPoint Name of authorization extension point specific to the resource for which the authorization
   * needs to be performed. The method invokes all plugins registered to the specified extension point giving them a
   * chance to perform their authorization logic.
   * -- The plugins are called in the same order as returned by the registry.
   * -- Each plugin is passed a plain JavaScript object containing the authorization result evaluated so far from previous plugins.
   * -- Each plugin gets a chance to inspect the authorization result collected so far and return authorization effect as
   * "allow" or "deny". i.e., each subsequent plugin has a chance to loosen or tighten the permissions returned by previous
   * plugins.
   * -- The authorization result with effect returned from the last plugin will be used as an effective authorization answer.
   * These plugins are expected to implement "authorize" method. The method may be sync or async (i.e., it may return a promise).
   * If it returns promise, it is awaited before calling the next plugin.
   *
   * @param resource The resource for which the authorization needs to be performed (Optional).
   *
   * @param action The action for which the authorization needs to be performed
   *
   * @param conditions Optional condition function or an array of functions. All conditions are assumed to be connected
   * by AND i.e., all condition functions must return "allow" for the action to be authorized. These functions are
   * invoked with the same arguments that the authorizer plugin is invoked with. i.e.,
   * "(requestContext, container, permissionsSoFar, ...args)".
   * The "permissionsSoFar" is permissions returned by the previous function in the array. It is an object with the
   * shape {resource, action, effect, reason}. These condition functions can be sync or async
   * (i.e., they can return a Promise). If the function returns a promise, it is awaited first before calling the next
   * function in the array. (i.e., the next function is not invoked until the returned promise either resolves or rejects).
   * The effective permissions as a result of evaluating all conditions (with implicit AND between them) is passed to
   * the plugins registered against the specified "extension-point". These plugins can inspect these permissions and
   * return permission as is or change it. In other words, the plugins can override permissions resulted by evaluating
   * the conditions. This allows the plugins to loosen/tighten permissions as per their requirements.
   *
   * @param args Additional arguments to pass to the plugins for the specified extension point. These arguments are also
   * passed to the condition functions.
   *
   * @returns {Promise<{reason, effect: string}>} A promise that resolves to effective permissions for the specified
   * action and principal (the principal information is retrieved from requestContext)
   */
  async authorize(requestContext, { extensionPoint, resource, action, conditions }, ...args) {
    const pluginRegistryService = await this.service('pluginRegistryService');
    const plugins = (await pluginRegistryService.getPluginsWithMethod(extensionPoint, 'authorize')) || [];

    const defaultAuthorizerPlugins = await this.toAuthorizerPlugins(conditions); // convert default authorizer functions to plugin objects
    const authorizerPlugins = [...defaultAuthorizerPlugins, ...plugins]; // Merge default (inline) authorizers with the authorizer plugins from the registry

    let effectSoFar;
    let reasonSoFar;
    // Give each plugin a chance to perform authorization.
    // -- Each plugin is passed a plain JavaScript object containing the authorization result evaluated so far from other plugins.
    // -- The plugins are called in the same order as returned by the registry.
    // -- Each plugin gets a chance to inspect the authorization result collected so far and return authorization effect as "allow" or "deny".
    // -- The authorization result with effect returned from the last plugin will be used as an effective authorization answer.
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of authorizerPlugins) {
      const { effect: resultEffect, reason: resultReason } =
        // need to await in strict order so disabling "no-await-in-loop" rule here
        // eslint-disable-next-line no-await-in-loop
        (await plugin.authorize(
          requestContext,
          this.container, // Pass services container to the plugins to allow them to find/use any services they require
          { resource, action, effect: effectSoFar, reason: reasonSoFar }, // pass authorization result so far
          ...args,
        )) || {};

      effectSoFar = resultEffect;
      reasonSoFar = resultReason;
    }

    // if effectSoFar is still undefined then default to implicit "deny"
    if (!effectSoFar) {
      return deny('No plugins returned any permissions so returning implicit deny');
    }

    return { effect: effectSoFar, reason: reasonSoFar };
  }

  /**
   * A method similar to the {@link authorize} method except that this method throws forbidden exception if the
   * authorization results in "deny".
   *
   * @param requestContext
   * @param extensionPoint
   * @param resource
   * @param action
   * @param conditions
   * @param args
   * @returns {Promise<void>}
   *
   * @see authorize
   */
  async assertAuthorized(requestContext, { extensionPoint, resource, action, conditions }, ...args) {
    const result = await this.authorize(requestContext, { extensionPoint, resource, action, conditions }, ...args);
    if (_.toLower(result.effect) !== 'allow') {
      const isSafe = _.get(result, 'reason.safe');
      const reasonMessage = _.get(result, 'reason.message');
      const errorMessage = isSafe && reasonMessage ? reasonMessage : 'You are not authorized to perform this operation';
      if (!isSafe) {
        // Make sure to log the original authorization result with denial for troubleshooting, if
        // the denial reason message is not safe to propagate beyond service boundary.
        this.log.warn({ extensionPoint, resource, action, ...result });
      }
      // if the principal is not authorized to perform the specified action then throw error
      throw this.boom.forbidden(errorMessage, true);
    }
  }

  // Private methods
  async toAuthorizerPlugins(conditionFns) {
    if (conditionFns) {
      const fns = _.isArray(conditionFns) ? conditionFns : [conditionFns];
      const conditionsAsPlugins = _.map(fns, fn => ({
        authorize: async (requestContext, container, { resource, action, effect, reason }, ...args) => {
          // if effect is "deny" already (due to any of the previous plugins returning "deny") then return "deny" right away
          if (isDeny({ effect })) return { resource, action, effect, reason };

          // If not denied yet then call the condition function
          return fn(requestContext, { resource, action, effect, reason }, ...args);
        },
      }));
      return conditionsAsPlugins;
    }
    return [];
  }
}

module.exports = AuthorizationService;
