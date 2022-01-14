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

const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const [userService] = await context.service(['userService', 'dbPasswordService']);

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

  // TODO: Do we want to keep this API and support creating Cognito users? Currently API only support creating internal users
  // ===============================================================
  //  POST / (mounted to /api/users)
  // ===============================================================
  // router.post(
  //   '/',
  //   wrap(async (req, res) => {
  //   }),
  // );

  // ===============================================================
  //  PUT /:uid (mounted to /api/users)
  // ===============================================================
  router.put(
    '/:uid',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const uid = req.params.uid;
      const { firstName, lastName, email, isAdmin, status, rev } = req.body;
      const user = await userService.updateUser(requestContext, {
        uid,
        firstName,
        lastName,
        email,
        isAdmin: _.isNil(isAdmin) ? false : isAdmin,
        status: _.isNil(status) ? 'active' : status,
        rev,
      });
      res.status(200).json(user);
    }),
  );

  // TODO: Do we want to support changing user passwords? Currently this API is only supported for internal Auth
  // ===============================================================
  //  PUT /:username/password (mounted to /api/users)
  //  In this case it is relevant to identify user by username/authProvider
  // ===============================================================
  // router.put(
  //   '/:username/password',
  //   wrap(async (req, res) => {
  //   }),
  // );

  return router;
}

module.exports = configure;
