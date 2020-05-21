// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;

  const projectService = await context.service('projectService');

  // ===============================================================
  //  GET / (mounted to /api/projects)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const result = await projectService.list(requestContext);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/projects)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await projectService.mustFind(requestContext, { id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/projects)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await projectService.create(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:id (mounted to /api/projects)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const body = req.body || {};

      if (body.id !== id)
        throw boom.badRequest(
          'The project id provided in the url does not match the one in the submitted json object',
          true,
        );

      const result = await projectService.update(requestContext, body);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/projects)
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      await projectService.delete(requestContext, { id });
      res.status(200).json({});
    }),
  );

  return router;
}

module.exports = configure;
