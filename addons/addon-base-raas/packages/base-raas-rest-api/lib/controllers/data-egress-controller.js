async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // TODO: more routers to be added

  // ===============================================================
  //  GET /:id (mounted to /api/data-egress/:id)
  // ===============================================================
  router.get(
    '/',
    wrap(async () => {
      // TODO: use actual data-egress-service to fetch egress store info
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/data-egress/:id
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const [dataEgressService] = await context.service(['dataEgressService']);
      await dataEgressService.terminateEgressStore(requestContext, id);
      res.status(200).json({});
    }),
  );

  return router;
}

module.exports = configure;
