async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const boom = context.boom;
  const [userService, dbPasswordService] = await context.service(['userService', 'dbPasswordService']);

  // ===============================================================
  //  GET / (mounted to /api/users)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const users = await userService.listUsers(requestContext);
      res.status(200).json(users);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/users)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const createdUser = await userService.createUser(requestContext, req.body);
      res.status(200).json(createdUser);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/users/bulk)
  // ===============================================================
  router.post(
    '/bulk',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const users = req.body;
      const defaultAuthNProviderId = req.query.authenticationProviderId;
      const result = await userService.createUsers(requestContext, users, defaultAuthNProviderId);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:username (mounted to /api/users)
  // ===============================================================
  router.put(
    '/:username',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const username = req.params.username;
      const userInBody = req.body || {};
      const user = await userService.updateUser(requestContext, {
        ...userInBody,
        username,
      });
      res.status(200).json(user);
    }),
  );

  // ===============================================================
  //  PUT /:username/password (mounted to /api/users)
  // ===============================================================
  router.put(
    '/:username/password',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const username = req.params.username;
      const { password } = req.body;

      // Save password salted hash for the user in internal auth provider (i.e., in passwords table)
      await dbPasswordService.savePassword(requestContext, { username, password });
      res.status(200).json({ username, message: `Password successfully updated for user ${username}` });
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/users)
  // ===============================================================
  router.delete(
    '/:username',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username } = req.params;
      const { authenticationProviderId, identityProviderName } = req.body;
      await userService.deleteUser(requestContext, {
        username,
        authenticationProviderId,
        identityProviderName,
      });
      res.status(200).json({ message: `user ${username} deleted` });
    }),
  );

  return router;
}

module.exports = configure;
