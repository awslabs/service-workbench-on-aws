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

module.exports = async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // ===============================================================
  //  A middleware
  // ===============================================================
  router.all(
    '*',
    wrap(async (req, res, next) => {
      res.locals.authenticated = false; // start with false;
      const { context: { authorizer } = {} } = req;
      if (authorizer) {
        const { token, isApiKey, username, identityProviderName, authenticationProviderId } = authorizer;
        res.locals.token = token;
        res.locals.isApiKey = isApiKey; // may be undefined if the token is not an api key
        res.locals.username = username;
        res.locals.identityProviderName = identityProviderName;
        res.locals.authenticationProviderId = authenticationProviderId;
        res.locals.authenticated = true;
      }
      next();
    }),
  );
  return router;
};
