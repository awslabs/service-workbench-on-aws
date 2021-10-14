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

  // TODO: more routers to be added

  // ===============================================================
  //  GET /:id (mounted to /api/data-egress/:id)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const [dataEgressService] = await context.service(['dataEgressService']);
      const result = await dataEgressService.getEgressStore(requestContext, id);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /:id (mounted to /api/data-egress/:id
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const [dataEgressService] = await context.service(['dataEgressService']);
      await dataEgressService.terminateEgressStore(requestContext, id);
      res.status(200).json({});
    }),
  );

  // ===============================================================
  //  POST (mounted to /api/data-egress/notify
  // ===============================================================
  router.post(
    '/notify',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.body.id;
      const [dataEgressService] = await context.service(['dataEgressService']);
      const result = await dataEgressService.notifySNS(requestContext, id);
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
