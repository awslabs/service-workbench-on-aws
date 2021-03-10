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

// const mime = require('mime');
// var fs = require('fs');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;

  const [costsService] = await context.service(['costsService']);

  // ===============================================================
  //  GET / (mounted to /api/costs)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const result = await costsService.getIndividualEnvironmentOrProjCost(requestContext, req.query);
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
