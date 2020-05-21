async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  const [externalCfnTemplateService] = await context.service(['externalCfnTemplateService']);

  // ===============================================================
  //  GET /:id (mounted to /api/template)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const key = req.params.id;
      const result = await externalCfnTemplateService.mustGetSignS3Url(key);
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
