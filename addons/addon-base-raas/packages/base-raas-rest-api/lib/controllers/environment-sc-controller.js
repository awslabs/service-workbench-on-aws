async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // ===============================================================
  //  GET / (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const [environmentScService] = await context.service(['environmentScService']);
      const result = await environmentScService.list(requestContext);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const [environmentScService] = await context.service(['environmentScService']);
      const result = await environmentScService.mustFind(requestContext, { id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.get(
    '/:id/connections/:connectionId/url',
    wrap(async (req, res) => {
      const id = req.params.id;
      const connectionId = req.params.connectionId;
      const requestContext = res.locals.requestContext;

      const [environmentScNotebookUrlService] = await context.service(['environmentScNotebookUrlService']);
      const result = await environmentScNotebookUrlService.getConnectionUrl(requestContext, id, connectionId);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;

      const [environmentScService] = await context.service(['environmentScService']);
      const result = await environmentScService.create(requestContext, possibleBody);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const [environmentScService] = await context.service(['environmentScService']);
      await environmentScService.delete(requestContext, { id });
      res.status(200).json({});
    }),
  );

  return router;
}

module.exports = configure;
