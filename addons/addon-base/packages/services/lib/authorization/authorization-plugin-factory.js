/**
 * A utility authorization plugin factory that creates an authorization plugin that delegates authorization to the
 * specified service. The plugin returned by this factory can be registered with the plugin registry for the "*-authz"
 * extension points.
 * The authorization-service invokes these plugins in the same order as they are registered in the plugin registry.
 * Each plugin instance gets a chance to perform authorization.
 * -- Each plugin is passed a plain JavaScript object containing the authorization result evaluated so far from other plugins.
 * -- Each plugin gets a chance to inspect the authorization result (i.e., effect) from previous plugins and return its own authorization effect as "allow" or "deny".
 * -- The authorization result with effect returned from the last plugin will be used as an effective authorization answer.
 *
 * The plugin returned by this factory delegates authorization to the authorization service specified by the
 * "authorizationServiceName" argument. The plugin looks up the service using the specified "authorizationServiceName"
 * from the services container.
 *
 * @param authorizationServiceName Name of the authorization service in the services container to delegate to.
 * If a non-existent authorizationServiceName specified then the plugin skips calling the service and returns the
 * permissions passed to it as is.
 *
 * @returns {{authorize: authorize}}
 */
const factory = authorizationServiceName => {
  const plugin = {
    /**
     * @param requestContext The request context object containing principal (caller) information.
     * The principal's identifier object is expected to be available as "requestContext.principalIdentifier" and the
     *
     * @param container The services container
     *
     * @param resource The resource for which the authorization needs to be performed (Optional).
     *
     * @param action The action for which the authorization needs to be performed
     *
     * @param effect Initial permission decision (e.g., effect = 'allow' or effect = 'deny'). This is optional argument
     * as an initial default permissions decision. This will be undefined for the first plugin instance. This will be
     * populated with permission evaluated from previous plugins in the plugins list (as returned by the plugin registry).

     * @param reason An optional object containing information about a reason for a specific authorization decision.
     * For example, if an authorization service denies a request it can populate the reason for denial. The reason has
     * the following shape {message: string, safe: boolean}.
     * -- The "reason.message" indicates some reasoning message as a string.
     * -- The "reason.safe" is a flag indicating if it's safe to propagate this authorization reason across the service boundary (e.g., to the UI)
     *
     * @param args Other arguments. These arguments are passed "as is" to the underlying authorization service.
     *
     * @returns {Promise<{effect: *}|{reason: {message: string, safe: boolean}, effect: string}|{reason: *, resource: *, effect: *, action: *}|{effect: *}>}
     */
    authorize: async (requestContext, container, { resource, action, effect, reason }, ...args) => {
      // if no authorizer is specified then return immediately with the current authorization decision collected so far
      if (!authorizationServiceName) return { effect, reason }; // guard condition

      // Lookup a service named as the given "authorizerName" after prefixing it with the specified scope
      const resourceAuthorizationService = await container.find(authorizationServiceName);

      // if no scoped authorizer is found then return immediately with the current authorization decision collected so far
      if (!resourceAuthorizationService) return { effect, reason }; // guard condition

      // if authorizer is found then give it a chance to perform its own authorization logic
      const result = await resourceAuthorizationService.authorize(
        requestContext,
        { resource, action, effect, reason },
        ...args,
      );
      return result;
    },
  };

  return plugin;
};

module.exports = factory;
