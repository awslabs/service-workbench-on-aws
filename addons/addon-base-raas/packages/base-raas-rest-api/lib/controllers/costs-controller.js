// const mime = require('mime');
// var fs = require('fs');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  const [costsService] = await context.service(['costsService']);

  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const result = await costsService.getIndividualEnvironmentOrProjCost(requestContext, req.query);
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
