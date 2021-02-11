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

  const [studyService, studyPermissionService, environmentMountService, lockService] = await context.service([
    'studyService',
    'studyPermissionService',
    'environmentMountService',
    'lockService',
  ]);

  // ===============================================================
  //  GET / (mounted to /api/studies)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
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
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      await studyPermissionService.verifyRequestorAccess(requestContext, id, req.method);

      const result = await studyService.mustFind(requestContext, id);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:id (mounted to /api/studies)
  // ===============================================================
  router.put(
    '/:id',
    wrap(async (req, res) => {
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

      // Validate permissions and usage
      await studyPermissionService.verifyRequestorAccess(requestContext, studyId, req.method);

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
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await studyService.create(requestContext, possibleBody);

      // TODO we should move this call to the studyService itself, otherwise we need to do result.access = ['admin'];
      await studyPermissionService.create(requestContext, result.id);
      result.access = ['admin']; // TODO see the todo comment above

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/files (mounted to /api/studies)
  // ===============================================================
  router.get(
    '/:id/files',
    wrap(async (req, res) => {
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;

      await studyPermissionService.verifyRequestorAccess(requestContext, studyId, req.method);

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
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;
      const filenames = req.query.filenames.split(',');

      // Check permissions against an UPLOAD request.
      // Note that we are not checking against 'PUT' which is an admin only feature since a user with 'Write'
      // access should also be able to upload files to the study
      await studyPermissionService.verifyRequestorAccess(requestContext, studyId, 'UPLOAD');

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
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;

      await studyPermissionService.verifyRequestorAccess(requestContext, studyId, req.method);

      const result = await studyPermissionService.findByStudy(requestContext, studyId);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /:id/permissions (mounted to /api/studies)
  // ===============================================================
  router.put(
    '/:id/permissions',
    wrap(async (req, res) => {
      const studyId = req.params.id;
      const requestContext = res.locals.requestContext;
      const updateRequest = req.body;

      // Validate permissions and usage
      // For future - Move authZ logic inside service (or new service) & move away from verifyRequestorAccess
      await studyPermissionService.verifyRequestorAccess(requestContext, studyId, req.method);
      const study = await studyService.mustFind(requestContext, studyId);
      if (study.category === 'My Studies') {
        throw context.boom.forbidden('Permissions cannot be set for studies in the "My Studies" category', true);
      }
      if (study.category === 'Open Data') {
        throw context.boom.forbidden('Permissions cannot be set for studies in the "Open Data" category', true);
      }

      const result = await lockService.tryWriteLockAndRun({ id: `${studyId}-workspaces` }, async () => {
        const updateOutcome = await studyPermissionService.update(requestContext, studyId, updateRequest);
        await environmentMountService.applyWorkspacePermissions(studyId, updateRequest);
        // Nice-to-have: Add number of workspaces updated to result object
        return updateOutcome;
      });
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
