// const authProviderConstants = require('@aws-ee/base-services/lib/authentication-providers/constants')
//   .authenticationProviders;
const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;
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
      const authenticationProviderId =
        req.query.authenticationProviderId || requestContext.principal.authenticationProviderId;
      const identityProviderName = req.query.identityProviderName;

      const { username, firstName, lastName, email, userRole, status, projectId, applyReason } = req.body;
      const createdUser = await userService.createUser(requestContext, {
        username: username || email,
        authenticationProviderId,
        identityProviderName,
        email,
        firstName,
        lastName,
        projectId,
        userRole,
        status,
        applyReason,
      });

      // Save password salted hash for the user in internal auth provider (i.e., in passwords table)
      // await dbPasswordService.savePassword(requestContext, { username, password });

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
      await userService.createUsers(requestContext, users, defaultAuthNProviderId);
      res.status(200).json({ message: 'success bulk add user' });
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
      const authenticationProviderId =
        req.query.authenticationProviderId || requestContext.principal.authenticationProviderId;
      const {
        firstName,
        lastName,
        email,
        isAdmin,
        status,
        rev,
        userRole,
        projectId,
        identityProviderName,
        encryptedCreds,
      } = req.body;
      const user = await userService.updateUser(requestContext, {
        username,
        authenticationProviderId,
        identityProviderName: _.isEmpty(identityProviderName) ? req.query.identityProviderName : identityProviderName,
        firstName,
        lastName,
        email,
        isAdmin,
        status,
        rev,
        userRole,
        projectId,
        encryptedCreds,
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
      const authenticationProviderId =
        req.query.authenticationProviderId || requestContext.principal.authenticationProviderId;
      if (authenticationProviderId !== requestContext.principal.authenticationProviderId) {
        throw boom.badRequest(
          `Cannot create user for authentication provider ${authenticationProviderId}. Currently adding users is only supported for internal authentication provider.`,
          true,
        );
      }
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
      const authenticationProviderId =
        req.query.authenticationProviderId || requestContext.principal.authenticationProviderId;
      const identityProviderName = req.query.identityProviderName;
      const { username } = req.params;
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
