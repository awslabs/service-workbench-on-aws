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
const authProviderConstants = require('@aws-ee/base-api-services/lib/authentication-providers/constants')
  .authenticationProviders;

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;
  const [userService, dbPasswordService] = await context.service(['userService', 'dbPasswordService']);

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
      const authenticationProviderId =
        req.query.authenticationProviderId || authProviderConstants.internalAuthProviderId;
      const identityProviderName = req.query.identityProviderName; // This is currently always null or undefined for "internal" auth provider
      if (authenticationProviderId !== authProviderConstants.internalAuthProviderId) {
        throw boom.badRequest(
          `Cannot create user for authentication provider ${authenticationProviderId}. Currently adding users is only supported for internal authentication provider.`,
          true,
        );
      }
      const { username, firstName, lastName, email, isAdmin, status, password } = req.body;

      const createdUser = await userService.createUser(requestContext, {
        username,
        authenticationProviderId,
        identityProviderName,
        firstName,
        lastName,
        email,
        isAdmin: _.isNil(isAdmin) ? false : isAdmin,
        status,
        password,
      });

      res.status(200).json(createdUser);
    }),
  );

  // ===============================================================
  //  PUT /:username (mounted to /api/users)
  // ===============================================================
  router.put(
    '/:username',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const username = req.params.username;
      const authenticationProviderId =
        req.query.authenticationProviderId || authProviderConstants.internalAuthProviderId;
      const identityProviderName = req.query.identityProviderName;
      const { firstName, lastName, email, isAdmin, status, rev } = req.body;
      const user = await userService.updateUser(requestContext, {
        username,
        authenticationProviderId,
        identityProviderName,
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

  // ===============================================================
  //  PUT /:username/password (mounted to /api/users)
  // ===============================================================
  router.put(
    '/:username/password',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const username = req.params.username;
      const authenticationProviderId =
        req.query.authenticationProviderId || authProviderConstants.internalAuthProviderId;
      if (authenticationProviderId !== authProviderConstants.internalAuthProviderId) {
        throw boom.badRequest(
          `Cannot create user for authentication provider ${authenticationProviderId}. Currently adding users is only supported for internal authentication provider.`,
          true,
        );
      }
      const { password } = req.body;

      // Save password salted hash for the user in internal auth provider (i.e., in passwords table)
      await dbPasswordService.savePassword(requestContext, { username, password });
      res.status(200).json({ username, message: `Password successfully updated for user ${username}` });
    }),
  );

  return router;
}

module.exports = configure;
