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

  const budgetsService = await context.service('budgetsService');

  // ===============================================================
  //  GET /:id (mounted to /api/budgets)
  // ===============================================================
  router.get(
    '/aws-account/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await budgetsService.get(requestContext, id);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/budgets)
  // ===============================================================
  router.post(
    '/aws-account',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const requestBody = req.body;
      const result = await budgetsService.create(requestContext, requestBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/budgets)
  // ===============================================================
  router.put(
    '/aws-account',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const requestBody = req.body;
      const result = await budgetsService.update(requestContext, requestBody);

      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
