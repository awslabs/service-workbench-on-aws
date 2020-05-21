// const mime = require('mime');
// var fs = require('fs');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  const [
    environmentService,
    environmentKeypairService,
    environmentNotebookUrlService,
    environmentSpotPriceHistoryService,
  ] = await context.service([
    'environmentService',
    'environmentKeypairService',
    'environmentNotebookUrlService',
    'environmentSpotPriceHistoryService',
  ]);

  // ===============================================================
  //  GET / (mounted to /api/workspaces)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const result = await environmentService.list(requestContext);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/workspaces)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await environmentService.mustFind(requestContext, { id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/workspaces)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = requestContext.principal.isExternalUser
        ? await environmentService.createExternal(requestContext, possibleBody)
        : await environmentService.create(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/workspaces)
  // ===============================================================
  router.put(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await environmentService.update(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/workspaces)
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      await environmentService.delete(requestContext, { id });
      res.status(200).json({});
    }),
  );

  // ===============================================================
  //  GET /:id/keypair (mounted to /api/workspaces)
  // ===============================================================
  router.get(
    '/:id/keypair',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;

      const result = await environmentKeypairService.mustFind(requestContext, id);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/password (mounted to /api/workspaces)
  // ===============================================================
  router.get(
    '/:id/password',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;

      const result = await environmentService.getWindowsPasswordData(requestContext, { id });

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/url (mounted to /api/workspaces)
  // ===============================================================
  router.get(
    '/:id/url',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;
      const result = await environmentNotebookUrlService.getNotebookPresignedUrl(requestContext, id);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /pricing/:type (mounted to /api/workspaces)
  // ===============================================================
  router.get(
    '/pricing/:type',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const type = req.params.type;
      const result = await environmentSpotPriceHistoryService.getPriceHistory(requestContext, type);

      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
