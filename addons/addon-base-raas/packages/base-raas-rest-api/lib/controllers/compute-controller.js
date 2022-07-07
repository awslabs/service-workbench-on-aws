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
  // const wrap = context.wrap;

  // const computePlatformService = await context.service('computePlatformService');

  // ===============================================================
  //  GET /platforms (mounted to /api/compute)
  // ===============================================================
  // router.get(
  //   '/platforms',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //
  //     const platforms = await computePlatformService.listPlatforms(requestContext);
  //     res.status(200).json(platforms);
  //   }),
  // );
  //
  // // ===============================================================
  // //  GET /platforms/:id/configurations (mounted to /api/compute)
  // // ===============================================================
  // router.get(
  //   '/platforms/:id/configurations',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const id = req.params.id;
  //     const platforms = await computePlatformService.listConfigurations(requestContext, {
  //       platformId: id,
  //       includePrice: true,
  //     });
  //     res.status(200).json(platforms);
  //   }),
  // );

  return router;
}

module.exports = configure;
