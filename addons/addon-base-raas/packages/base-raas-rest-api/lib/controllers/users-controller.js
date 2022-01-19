/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const boom = context.boom;
  const [userService] = await context.service(['userService']);

  // ===============================================================
  //  GET / (mounted to /api/users)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const users = await userService.listUsers(requestContext);
      res.status(200).json(users);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/users)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const createdUser = await userService.createUser(requestContext, req.body);
      res.status(200).json(createdUser);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/users/bulk)
  // ===============================================================
  router.post(
    '/bulk',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const users = req.body;
      const defaultAuthNProviderId = req.query.authenticationProviderId;
      const result = await userService.createUsers(requestContext, users, defaultAuthNProviderId);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:username (mounted to /api/users)
  // ===============================================================
  router.put(
    '/:uid',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const uid = req.params.uid;
      const userInBody = req.body || {};
      const user = await userService.updateUser(requestContext, {
        ...userInBody,
        uid,
      });
      res.status(200).json(user);
    }),
  );

  // ===============================================================
  //  DELETE /:uid (mounted to /api/users)
  // ===============================================================
  // router.delete(
  //   '/:uid',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const { uid } = req.params;
  //     const deletedUser = await userService.deleteUser(requestContext, {
  //       uid,
  //     });
  //     res.status(200).json({ message: `user ${deletedUser.username} deleted` });
  //   }),
  // );

  return router;
}

module.exports = configure;
