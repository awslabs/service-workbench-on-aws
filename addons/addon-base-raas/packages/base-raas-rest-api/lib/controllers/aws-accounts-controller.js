// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const boom = context.boom;

  const awsAccountsService = await context.service('awsAccountsService');
  const accountService = await context.service('accountService');

  // ===============================================================
  //  GET / (mounted to /api/aws-accounts)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const awsAccounts = await awsAccountsService.list(requestContext);
      res.status(200).json(awsAccounts);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/aws-accounts)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await awsAccountsService.mustFind(requestContext, { id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/aws-accounts)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await awsAccountsService.create(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/aws-accounts)
  // ===============================================================
  router.post(
    '/provision',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      await accountService.provisionAccount(requestContext, possibleBody);

      res.status(200).json({ message: 'account creating' });
    }),
  );

  return router;
}

module.exports = configure;
