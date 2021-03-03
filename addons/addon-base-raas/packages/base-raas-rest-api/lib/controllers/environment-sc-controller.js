const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;

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
  //  PUT / (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.put(
    '/:id/start',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;
      const operation = 'start';

      const [environmentScService] = await context.service(['environmentScService']);
      const result = await environmentScService.changeWorkspaceRunState(requestContext, { id, operation });

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.put(
    '/:id/stop',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;
      const operation = 'stop';

      const [environmentScService] = await context.service(['environmentScService']);
      const result = await environmentScService.changeWorkspaceRunState(requestContext, { id, operation });

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.post(
    '/:id/cidr',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;
      const updateRequest = req.body.cidr;

      const [environmentScCidrService] = await context.service(['environmentScCidrService']);
      const result = await environmentScCidrService.update(requestContext, {
        id,
        updateRequest,
      });

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/connections (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.get(
    '/:id/connections',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const [environmentScConnectionService] = await context.service(['environmentScConnectionService']);
      const result = await environmentScConnectionService.listConnections(requestContext, id);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /:id/connections/:connectionId/url (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.post(
    '/:id/connections/:connectionId/url',
    wrap(async (req, res) => {
      const id = req.params.id;
      const connectionId = req.params.connectionId;
      const requestContext = res.locals.requestContext;
      if (!_.isEmpty(req.body)) {
        throw boom.badRequest(`Invalid request. This API does not expect a request body.`, true);
      }

      const [environmentScConnectionService] = await context.service(['environmentScConnectionService']);
      const result = await environmentScConnectionService.createConnectionUrl(requestContext, id, connectionId);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET  /:id/connections/:connectionId/windows-rdp-info (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.get(
    '/:id/connections/:connectionId/windows-rdp-info',
    wrap(async (req, res) => {
      const id = req.params.id;
      const connectionId = req.params.connectionId;
      const requestContext = res.locals.requestContext;

      const [environmentScConnectionService] = await context.service(['environmentScConnectionService']);
      const result = await environmentScConnectionService.getWindowsPasswordDataForRdp(
        requestContext,
        id,
        connectionId,
      );
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /:id/connections/:connectionId/send-ssh-public-key (mounted to /api/workspaces/service-catalog)
  // ===============================================================
  router.post(
    '/:id/connections/:connectionId/send-ssh-public-key',
    wrap(async (req, res) => {
      const envId = req.params.id;
      const connectionId = req.params.connectionId;
      const requestContext = res.locals.requestContext;

      const [environmentScConnectionService] = await context.service(['environmentScConnectionService']);
      const result = await environmentScConnectionService.sendSshPublicKey(
        requestContext,
        envId,
        connectionId,
        req.body,
      );
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
