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

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom;

  /**
   * A utility method that converts the given query string params "username", "ns" to appropriate filter principal value
   * that the service expects.
   *
   * @param query
   * @returns {*[]} principal filter object
   */
  function toPrincipalFilter(query) {
    const userNameInQuery = _.get(query, 'username');
    const nsInQuery = _.get(query, 'ns');
    const filter = {};
    if (userNameInQuery || nsInQuery) {
      // if username and ns query string params are specified then specify principal filter
      // The service is expecting filter.principal.principalIdentifier with { username, ns }
      filter.principal = { principalIdentifier: { username: userNameInQuery, ns: nsInQuery } };
    }
    return filter;
  }

  function assertOnlyRevInBody(requestBody) {
    const extraParams = _.difference(_.keys(requestBody), ['rev']);
    if (extraParams.length !== 0) {
      // Only expecting "rev" in the approve API, reject call if anything else is passed
      throw boom.badRequest(`Invalid request, unknown request parameters ${_.join(extraParams, ', ')}`, true);
    }
  }

  // ===============================================================
  //  GET / (mounted to /api/key-pairs)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [keyPairService] = await context.service(['keyPairService']);

      const list = await keyPairService.list(requestContext, {
        filter: toPrincipalFilter(req.query),
      });
      res.status(200).json(list);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/key-pairs)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [keyPairService] = await context.service(['keyPairService']);
      const result = await keyPairService.create(requestContext, req.body);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET / (mounted to /api/key-pairs)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [keyPairService] = await context.service(['keyPairService']);

      const keyPair = await keyPairService.mustFind(requestContext, { id: req.params.id });
      res.status(200).json(keyPair);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/key-pairs)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [keyPairService] = await context.service(['keyPairService']);
      if (req.body.id && req.params.id !== req.body.id) {
        throw boom.badRequest(`The id in the request body does not match with the one in the path`, true);
      }
      const keyPair = req.body;
      keyPair.id = req.params.id;
      const result = await keyPairService.update(requestContext, keyPair);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE / (mounted to /api/key-pairs)
  // ===============================================================
  router.delete(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [keyPairService] = await context.service(['keyPairService']);

      await keyPairService.delete(requestContext, { id: req.params.id });
      res.status(200).json({});
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/key-pairs)
  // ===============================================================
  router.put(
    '/:id/activate',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [keyPairService] = await context.service(['keyPairService']);
      assertOnlyRevInBody(req.body);
      const result = await keyPairService.activate(requestContext, { id: req.params.id, rev: req.body.rev });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT / (mounted to /api/key-pairs)
  // ===============================================================
  router.put(
    '/:id/deactivate',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const [keyPairService] = await context.service(['keyPairService']);
      assertOnlyRevInBody(req.body);
      const result = await keyPairService.deactivate(requestContext, { id: req.params.id, rev: req.body.rev });
      res.status(200).json(result);
    }),
  );

  return router;
}
module.exports = configure;
