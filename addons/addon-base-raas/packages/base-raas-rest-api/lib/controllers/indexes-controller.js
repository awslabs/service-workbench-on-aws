// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;

  const indexesService = await context.service('indexesService');

  // ===============================================================
  //  GET / (mounted to /api/indexes)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const result = await indexesService.list(requestContext);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/indexes)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await indexesService.mustFind(requestContext, { id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/indexes)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await indexesService.create(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:id (mounted to /api/indexes)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const body = req.body || {};

      if (body.id !== id)
        throw boom.badRequest(
          'The indexes id provided in the url does not match the one in the submitted json object',
          true,
        );

      const result = await indexesService.update(requestContext, body);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/indexes)
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      await indexesService.delete(requestContext, { id });
      res.status(200).json({});
    }),
  );

  return router;
}

module.exports = configure;
