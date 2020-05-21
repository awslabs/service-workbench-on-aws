async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const apiKeyService = await context.service('apiKeyService');

  // ===============================================================
  //  GET / (mounted to /api/api-keys)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const apiKeys = await apiKeyService.getApiKeys(requestContext, { username: usernameToUse, ns: nsToUse });
      res.status(200).json(apiKeys);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/api-keys)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const keyId = req.params.id;
      const apiKey = await apiKeyService.getApiKey(requestContext, { username: usernameToUse, ns: nsToUse, keyId });
      res.status(200).json(apiKey);
    }),
  );

  // ===============================================================
  //  PUT /:id/revoke (mounted to /api/api-keys)
  // ===============================================================
  router.put(
    '/:id/revoke',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const keyId = req.params.id;
      const apiKey = await apiKeyService.revokeApiKey(requestContext, { username: usernameToUse, ns: nsToUse, keyId });
      res.status(200).json(apiKey);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/api-keys)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const apiKey = await apiKeyService.issueApiKey(requestContext, {
        username: usernameToUse,
        ns: nsToUse,
        expiryTime: req.body.expiryTime,
      });
      res.status(200).json(apiKey);
    }),
  );

  return router;
}

module.exports = configure;
