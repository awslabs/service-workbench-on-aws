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

// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  // ===============================================================
  //  GET /accounts (mounted to /api/data-sources)
  // ===============================================================
  router.get(
    '/accounts',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const service = await context.service('dataSourceAccountService');
      const result = await service.listAccounts(requestContext);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /accounts (mounted to /api/data-sources)
  // ===============================================================
  router.post(
    '/accounts',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const service = await context.service('dataSourceAccountService');
      const result = await service.registerAccount(requestContext, possibleBody);

      res.status(201).json(result);
    }),
  );

  // ===============================================================
  //  PUT /accounts/:id (mounted to /api/data-sources)
  // ===============================================================
  router.put(
    '/accounts/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const service = await context.service('dataSourceAccountService');
      const result = await service.updateAccount(requestContext, { ...possibleBody, id });

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /accounts/:id/buckets (mounted to /api/data-sources)
  // ===============================================================
  router.post(
    '/accounts/:id/buckets',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const service = await context.service('dataSourceAccountService');
      const result = await service.registerBucket(requestContext, { ...possibleBody, accountId: id });

      res.status(201).json(result);
    }),
  );

  return router;
}

module.exports = configure;
