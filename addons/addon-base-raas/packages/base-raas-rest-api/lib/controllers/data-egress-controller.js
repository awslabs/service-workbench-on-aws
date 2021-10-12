async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // TODO: more routers to be added

  // ===============================================================
  //  GET /:id (mounted to /api/data-egress/:id)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const [dataEgressService] = await context.service(['dataEgressService']);
      const result = await dataEgressService.getEgressStore(requestContext, id);
      res.status(200).json(result);
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

  // ===============================================================
  //  POST (mounted to /api/data-egress/notify
  // ===============================================================
  router.post(
    '/notify',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.body.id;
      const [dataEgressService] = await context.service(['dataEgressService']);
      const result = await dataEgressService.notifySNS(requestContext, id);
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
