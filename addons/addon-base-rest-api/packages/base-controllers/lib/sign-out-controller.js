const _ = require('lodash');
const { newInvoker } = require('@aws-ee/base-api-services/lib/authentication-providers/helpers/invoker');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const settings = context.settings;
  const boom = context.boom;

  const providerConfigService = await context.service('authenticationProviderConfigService');
  const invoke = newInvoker(context.service.bind(context));
  // ===============================================================
  //  POST / (mounted to /api/authentication/logout)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      if (res.locals.isApiKey) {
        throw boom.badRequest('Logout API is not supported using api key', true);
      }
      const providerId = res.locals.authenticationProviderId;
      const token = res.locals.token;
      const requestContext = res.locals.requestContext;

      const providerConfig = await providerConfigService.getAuthenticationProviderConfig(providerId);
      const tokenRevokerLocator = _.get(providerConfig, 'config.type.config.impl.tokenRevokerLocator');
      if (!tokenRevokerLocator) {
        throw boom.badRequest(
          `Error logging out. The authentication provider with id = '${providerId}' does not support token revocation`,
          false,
        );
      }

      // invoke the token revoker and pass the token that needs to be revoked
      await invoke(tokenRevokerLocator, requestContext, { token }, providerConfig);
      res.status(200).json({ revoked: true });
    }),
  );

  return router;
}

module.exports = configure;
