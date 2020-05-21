// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  const computePlatformService = await context.service('computePlatformService');

  // ===============================================================
  //  GET /platforms (mounted to /api/compute)
  // ===============================================================
  router.get(
    '/platforms',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const platforms = await computePlatformService.listPlatforms(requestContext);
      res.status(200).json(platforms);
    }),
  );

  // ===============================================================
  //  GET /platforms/:id/configurations (mounted to /api/compute)
  // ===============================================================
  router.get(
    '/platforms/:id/configurations',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;
      const platforms = await computePlatformService.listConfigurations(requestContext, {
        platformId: id,
        includePrice: true,
      });
      res.status(200).json(platforms);
    }),
  );

  return router;
}

module.exports = configure;
