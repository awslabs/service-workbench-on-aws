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

const RequestContext = require('@aws-ee/base-services-container/lib/request-context');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const userService = await context.service('userService');

  // ===============================================================
  //  A middleware
  // ===============================================================
  // populate request context, if user is authenticated
  router.all(
    '*',
    wrap(async (req, res, next) => {
      const requestContext = new RequestContext();
      res.locals.requestContext = requestContext;
      const authenticated = res.locals.authenticated;
      const username = res.locals.username;
      const authenticationProviderId = res.locals.authenticationProviderId;
      const identityProviderName = res.locals.identityProviderName;

      if (!authenticated || !username) return next();

      const user = await userService.mustFindUser({
        username,
        authenticationProviderId,
        identityProviderName,
      });
      requestContext.authenticated = authenticated;
      requestContext.principal = user;
      requestContext.principalIdentifier = { username, ns: user.ns };

      return next();
    }),
  );

  return router;
}

module.exports = configure;
