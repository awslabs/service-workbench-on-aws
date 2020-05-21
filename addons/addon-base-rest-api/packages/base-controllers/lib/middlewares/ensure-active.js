async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;
  const userService = await context.service('userService');
  // ===============================================================
  //  A middleware
  // ===============================================================
  // Ensure the logged in user is Active before allowing this route access
  router.all(
    '*',
    wrap(async (req, res, next) => {
      const requestContext = res.locals.requestContext;

      const isActive = await userService.isCurrentUserActive(requestContext);
      if (!isActive) {
        // Do not allow any access if the logged in user is marked inactive in the system
        throw boom.unauthorized('Inactive user', true);
      }
      next();
    }),
  );

  return router;
}

module.exports = configure;
