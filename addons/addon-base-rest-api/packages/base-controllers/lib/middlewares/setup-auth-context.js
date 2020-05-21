module.exports = async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // ===============================================================
  //  A middleware
  // ===============================================================
  router.all(
    '*',
    wrap(async (req, res, next) => {
      res.locals.authenticated = false; // start with false;
      const { context: { authorizer } = {} } = req;
      if (authorizer) {
        const { token, isApiKey, username, identityProviderName, authenticationProviderId } = authorizer;
        res.locals.token = token;
        res.locals.isApiKey = isApiKey; // may be undefined if the token is not an api key
        res.locals.username = username;
        res.locals.identityProviderName = identityProviderName;
        res.locals.authenticationProviderId = authenticationProviderId;
        res.locals.authenticated = true;
      }
      next();
    }),
  );
  return router;
};
