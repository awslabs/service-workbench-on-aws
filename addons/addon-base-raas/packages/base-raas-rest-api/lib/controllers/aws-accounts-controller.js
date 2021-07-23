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
  // const boom = context.boom;

  const awsAccountsService = await context.service('awsAccountsService');
  const awsCfnService = await context.service('awsCfnService');
  const accountService = await context.service('accountService');

  // ===============================================================
  //  GET / (mounted to /api/aws-accounts)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;

      const awsAccounts = await awsAccountsService.list(requestContext);
      res.status(200).json(awsAccounts);
    }),
  );

  // ===============================================================
  //  GET /permissions (mounted to /api/aws-accounts)
  // ===============================================================
  router.get(
    '/permissions',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const result = await awsCfnService.batchCheckAndUpdateAccountPermissions(requestContext);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/get-template (mounted to /api/aws-accounts)
  // ===============================================================
  router.get(
    '/:id/get-template',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const result = await awsCfnService.getAndUploadTemplateForAccount(requestContext, id);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/aws-accounts)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await awsAccountsService.mustFind(requestContext, { id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/aws-accounts)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await awsAccountsService.create(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:id/update (mounted to /api/aws-accounts)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;
      const acctInBody = req.body || {};
      const awsAccount = await awsAccountsService.update(requestContext, {
        ...acctInBody,
        id,
      });

      res.status(200).json(awsAccount);
    }),
  );

  // ===============================================================
  //  POST /provision (mounted to /api/aws-accounts)
  // ===============================================================
  router.post(
    '/provision',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      await accountService.provisionAccount(requestContext, possibleBody);

      res.status(200).json({ message: 'account creating' });
    }),
  );

  // ===============================================================
  //  GET /:id/permissions (mounted to /api/aws-accounts)
  // ===============================================================
  router.get(
    '/:id/permissions',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const accountId = req.params.id;

      const result = await awsCfnService.checkAccountPermissions(requestContext, accountId);
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
