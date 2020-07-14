async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // ===============================================================
  //  GET / (mounted to /api/workspace-types/:id/config-vars)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [envTypeConfigVarService] = await context.service(['envTypeConfigVarService']);

      const envTypeId = req.params.id;
      const configs = await envTypeConfigVarService.list(requestContext, envTypeId);
      res.status(200).json(configs);
    }),
  );

  return router;
}
module.exports = configure;
