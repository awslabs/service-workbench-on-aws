// const authProviderConstants = require('@aws-ee/base-services/lib/authentication-providers/constants')
//   .authenticationProviders;
// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const boom = context.boom;
  const [userRolesService] = await context.service(['userRolesService']);

  // ===============================================================
  //  GET / (mounted to /api/user-roles)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const userRoles = await userRolesService.list();
      res.status(200).json(userRoles);
    }),
  );

  return router;
}

module.exports = configure;
