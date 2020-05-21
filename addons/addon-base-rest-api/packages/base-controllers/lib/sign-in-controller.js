const _ = require('lodash');
const { newInvoker } = require('@aws-ee/base-api-services/lib/authentication-providers/helpers/invoker');
const authProviderConstants = require('@aws-ee/base-api-services/lib/authentication-providers/constants')
  .authenticationProviders;

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const settings = context.settings;
  // const boom = context.boom;

  const authenticationProviderConfigService = await context.service('authenticationProviderConfigService');
  const invoke = newInvoker(context.service.bind(context));
  // ===============================================================
  //  POST / (mounted to /api/authentication/id-tokens)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const { username, password, authenticationProviderId } = req.body;

      // If no authentication provider id is specified in the request then assume this to be authenticated by the
      // internal authentication provider
      const authenticationProviderIdToUse = authenticationProviderId || authProviderConstants.internalAuthProviderId;

      const authProviderConfig = await authenticationProviderConfigService.getAuthenticationProviderConfig(
        authenticationProviderIdToUse,
      );
      const tokenIssuerLocator = _.get(authProviderConfig, 'config.type.config.impl.tokenIssuerLocator');
      const idToken = await invoke(tokenIssuerLocator, { username, password }, authProviderConfig);
      res.status(200).json({ idToken });
    }),
  );

  return router;
}

module.exports = configure;
