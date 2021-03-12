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

  // ===============================================================
  //  GET / (mounted to /api/studies)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const studyService = await context.service('studyService');
      const requestContext = res.locals.requestContext;
      const { category } = req.query;

      const result = await studyService.list(requestContext, category);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/studies)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const studyService = await context.service('studyService');
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await studyService.getStudyPermissions(requestContext, id);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:id (mounted to /api/studies)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
      const studyService = await context.service('studyService');
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;
      const updateRequest = req.body;

      // verify that studyId in request params is equal to the studyId provided in body of the request
      const updateRequestId = updateRequest.id;
      if (studyId !== updateRequestId) {
        throw context.boom.badRequest(
          `PUT request for "${studyId}" does not match id "${updateRequestId}" specified in the request`,
          true,
        );
      }

      const result = await studyService.update(requestContext, updateRequest);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST / (mounted to /api/studies)
  // ===============================================================
  router.post(
    '/',
    wrap(async (req, res) => {
      const studyService = await context.service('studyService');
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await studyService.create(requestContext, possibleBody);
      res.status(200).json({ ...result, access: ['admin'] });
    }),
  );

  // ===============================================================
  //  GET /:id/files (mounted to /api/studies)
  // ===============================================================
  router.get(
    '/:id/files',
    wrap(async (req, res) => {
      const studyService = await context.service('studyService');
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await studyService.listFiles(requestContext, studyId);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/upload-requests (mounted to /api/studies)
  // ===============================================================
  router.get(
    '/:id/upload-requests',
    wrap(async (req, res) => {
      const studyService = await context.service('studyService');
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;
      const filenames = req.query.filenames.split(',');

      const result = await studyService.createPresignedPostRequests(requestContext, studyId, filenames);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/permissions (mounted to /api/studies)
  // ===============================================================
  router.get(
    '/:id/permissions',
    wrap(async (req, res) => {
      const studyService = await context.service('studyService');
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;

      const result = await studyService.getStudyPermissions(requestContext, studyId);
      res.status(200).json(_.get(result, 'permissions'));
    }),
  );

  // ===============================================================
  //  PUT /:id/permissions (mounted to /api/studies)
  // ===============================================================
  router.put(
    '/:id/permissions',
    wrap(async (req, res) => {
      const studyOperationService = await context.service('studyOperationService');
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;
      const updateRequest = req.body;

      const result = await studyOperationService.updatePermissions(requestContext, studyId, updateRequest);
      res.status(200).json(_.get(result, 'permissions'));
    }),
  );

  return router;
}

module.exports = configure;
