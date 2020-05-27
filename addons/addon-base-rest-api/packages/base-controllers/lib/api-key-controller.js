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
  const apiKeyService = await context.service('apiKeyService');

  // ===============================================================
  //  GET / (mounted to /api/api-keys)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const apiKeys = await apiKeyService.getApiKeys(requestContext, { username: usernameToUse, ns: nsToUse });
      res.status(200).json(apiKeys);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/api-keys)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const keyId = req.params.id;
      const apiKey = await apiKeyService.getApiKey(requestContext, { username: usernameToUse, ns: nsToUse, keyId });
      res.status(200).json(apiKey);
    }),
  );

  // ===============================================================
  //  PUT /:id/revoke (mounted to /api/api-keys)
  // ===============================================================
  router.put(
    '/:id/revoke',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const keyId = req.params.id;
      const apiKey = await apiKeyService.revokeApiKey(requestContext, { username: usernameToUse, ns: nsToUse, keyId });
      res.status(200).json(apiKey);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/api-keys)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const { username, ns } = requestContext.principalIdentifier;
      // Is user is specified then perform operation for that user or else for current user
      const usernameToUse = req.query.username || username;
      const nsToUse = req.query.ns || ns;
      const apiKey = await apiKeyService.issueApiKey(requestContext, {
        username: usernameToUse,
        ns: nsToUse,
        expiryTime: req.body.expiryTime,
      });
      res.status(200).json(apiKey);
    }),
  );

  return router;
}

module.exports = configure;
