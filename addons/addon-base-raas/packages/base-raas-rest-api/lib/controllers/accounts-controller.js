// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;

  const accountService = await context.service('accountService');

  // ===============================================================
  //  GET / (mounted to /api/accounts)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const result = await accountService.list(requestContext);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/accounts)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await accountService.mustFind(requestContext, { id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/accounts)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await accountService.provisionAccount(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:id (mounted to /api/accounts)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const body = req.body || {};

      if (body.id !== id)
        throw boom.badRequest(
          'The accounts id provided in the url does not match the one in the submitted json object',
          true,
        );

      const result = await accountService.update(requestContext, body);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/accounts)
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      await accountService.delete(requestContext, { id });
      res.status(200).json({});
    }),
  );

  return router;
}

module.exports = configure;
