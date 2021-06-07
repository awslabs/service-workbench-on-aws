async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  //TODO: more routers to be added

  // ===============================================================
  //  GET /:id (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      // TODO: use actual data-egress-service to fetch egress store info
    }),
  );

  return router;
}

module.exports = configure;
