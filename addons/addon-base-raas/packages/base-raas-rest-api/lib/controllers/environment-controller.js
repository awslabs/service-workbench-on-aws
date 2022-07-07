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
  // const wrap = context.wrap;
  //
  // const [
  //   environmentService,
  //   environmentKeypairService,
  //   environmentUrlService,
  //   environmentSpotPriceHistoryService,
  // ] = await context.service([
  //   'environmentService',
  //   'environmentKeypairService',
  //   'environmentUrlService',
  //   'environmentSpotPriceHistoryService',
  // ]);
  //
  // // ===============================================================
  // //  GET / (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.get(
  //   '/',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //
  //     const result = await environmentService.list(requestContext);
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  GET /:id (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.get(
  //   '/:id',
  //   wrap(async (req, res) => {
  //     const id = req.params.id;
  //     const requestContext = res.locals.requestContext;
  //
  //     const result = await environmentService.mustFind(requestContext, { id });
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  POST / (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.post(
  //   '/',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const possibleBody = req.body;
  //     const result = requestContext.principal.isExternalUser
  //       ? await environmentService.createExternal(requestContext, possibleBody)
  //       : await environmentService.create(requestContext, possibleBody);
  //
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  PUT / (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.put(
  //   '/',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const possibleBody = req.body;
  //     const result = await environmentService.update(requestContext, possibleBody);
  //
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  PUT / (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.put(
  //   '/:id/start',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const id = req.params.id;
  //     const operation = 'start';
  //     const result = await environmentService.changeWorkspaceRunState(requestContext, { id, operation });
  //
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  PUT / (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.put(
  //   '/:id/stop',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const id = req.params.id;
  //     const operation = 'stop';
  //     const result = await environmentService.changeWorkspaceRunState(requestContext, { id, operation });
  //
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  DELETE /:id (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.delete(
  //   '/:id',
  //   wrap(async (req, res) => {
  //     const id = req.params.id;
  //     const requestContext = res.locals.requestContext;
  //
  //     await environmentService.delete(requestContext, { id });
  //     res.status(200).json({});
  //   }),
  // );
  //
  // // ===============================================================
  // //  GET /:id/keypair (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.get(
  //   '/:id/keypair',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const id = req.params.id;
  //
  //     const result = await environmentKeypairService.mustFind(requestContext, id);
  //
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  GET /:id/password (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.get(
  //   '/:id/password',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const id = req.params.id;
  //
  //     const result = await environmentService.getWindowsPasswordData(requestContext, { id });
  //
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  GET /:id/url (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.get(
  //   '/:id/url',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const id = req.params.id;
  //     const result = await environmentUrlService.get(requestContext, id);
  //
  //     res.status(200).json(result);
  //   }),
  // );
  //
  // // ===============================================================
  // //  GET /pricing/:type (mounted to /api/workspaces/built-in)
  // // ===============================================================
  // router.get(
  //   '/pricing/:type',
  //   wrap(async (req, res) => {
  //     const requestContext = res.locals.requestContext;
  //     const type = req.params.type;
  //     const result = await environmentSpotPriceHistoryService.getPriceHistory(requestContext, type);
  //
  //     res.status(200).json(result);
  //   }),
  // );

  return router;
}

module.exports = configure;
