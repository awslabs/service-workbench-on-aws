async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const [userService] = await context.service(['userService']);

  // ===============================================================
  //  GET / (mounted to /api/user)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const user = res.locals.requestContext.principal;
      res.status(200).json(user);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/user)
  // ===============================================================
  // This is for self-service update
  router.put(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const currentUser = requestContext.principal;
      // Get current user's attributes to identify the user in the system
      const { username, authenticationProviderId, identityProviderName } = currentUser;
      const userToUpdate = req.body;
      const updatedUser = await userService.updateUser(requestContext, {
        ...userToUpdate,
        username,
        authenticationProviderId,
        identityProviderName,
      });
      res.status(200).json(updatedUser);
    }),
  );

  return router;
}

module.exports = configure;
