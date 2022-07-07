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
  const boom = context.boom;

  const workflowTemplateService = await context.service('workflowTemplateService');
  const workflowTemplateDraftService = await context.service('workflowTemplateDraftService');

  // ===============================================================
  //  GET /drafts (mounted to /api/workflow-templates)
  // ===============================================================
  router.get(
    '/drafts',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const result = await workflowTemplateDraftService.list(requestContext);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET / (mounted to /api/workflow-templates)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const result = await workflowTemplateService.listVersions();
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /latest (mounted to /api/workflow-templates)
  // ===============================================================
  router.get(
    '/latest',
    wrap(async (req, res) => {
      const result = await workflowTemplateService.list();
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/workflow-templates)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;

      const result = await workflowTemplateService.listVersions({ id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/latest (mounted to /api/workflow-templates)
  // ===============================================================
  router.get(
    '/:id/latest',
    wrap(async (req, res) => {
      const id = req.params.id;

      const result = await workflowTemplateService.mustFindVersion({ id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/v/:v (mounted to /api/workflow-templates)
  // ===============================================================
  router.get(
    '/:id/v/:v',
    wrap(async (req, res) => {
      const id = req.params.id;
      const v = req.params.v;

      const result = await workflowTemplateService.mustFindVersion({ id, v });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /:id/v/ (mounted to /api/workflow-templates)
  // ===============================================================
  router.post(
    '/:id/v/',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const manifest = req.body;

      if (manifest.id !== id) throw boom.badRequest('The workflow template ids do not match', true);

      const result = await workflowTemplateService.createVersion(requestContext, manifest);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /drafts (mounted to /api/workflow-templates)
  // ===============================================================
  router.post(
    '/drafts',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await workflowTemplateDraftService.createDraft(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /drafts/publish (mounted to /api/workflow-templates)
  // ===============================================================
  router.post(
    '/drafts/publish',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const draft = req.body;
      const result = await workflowTemplateDraftService.publishDraft(requestContext, draft);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /drafts/:id (mounted to /api/workflow-templates)
  // ===============================================================
  router.put(
    '/drafts/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const draft = req.body;

      if (draft.id !== id) throw boom.badRequest('The workflow template draft ids do not match', true);

      const result = await workflowTemplateDraftService.updateDraft(requestContext, draft);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /drafts/:id (mounted to /api/workflow-templates)
  // ===============================================================
  router.delete(
    '/drafts/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      await workflowTemplateDraftService.deleteDraft(requestContext, { id });
      res.status(200).json({});
    }),
  );

  return router;
}

module.exports = configure;
