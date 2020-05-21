const { ensureAdmin } = require('@aws-ee/base-services/lib/authorization/assertions');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // ===============================================================
  //  A middleware
  // ===============================================================
  // Ensure the logged in user is Admin before allowing this route access
  router.all(
    '*',
    wrap(async (req, res, next) => {
      const requestContext = res.locals.requestContext;
      await ensureAdmin(requestContext);
      next();
    }),
  );

  return router;
}

module.exports = configure;
