async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const [auth0Service] = await context.service(['auth0Service']);
  // ===============================================================
  //  POST / (mounted to /api/auth0/users)
  // ===============================================================
  router.post(
    '/users',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      auth0Service.init();
      const fileContent = req.body.fileData;
      // TODO: pass the content to service you need to do following in the service:
      await auth0Service.auth0UserToAppUser(fileContent, requestContext);
      // 1. turn string to json format(array)
      // 2. in each of the item in array, mimic the createUser service, create user object
      // 3. pass the user obj to createUser service
      // 4. suceess, use awiat

      // get auth0 management token
      // use code example solution/packages/services/lib/environment/environment-keypair-service.js to get the settings which is app id and creds

      // const token = await auth0Service.getAuth0Token();
      // with instance(token retrived) specified, the following call should be make:
      // 1. call to retrive connection id with strategy: auth0
      // 2. call the bulk api to send the userinfo and retrive the jobid
      // 3. wait for the bulk job is finished and return job finish 200 status
      // const auth0ConnectionId = await auth0Service.getConnectionId(token);
      // const jobId = await auth0Service.uploadUsersFile(fileContent, token, auth0ConnectionId);
      res.status(200).json({
        message: 'success',
      });
    }),
  );

  return router;
}

module.exports = configure;
