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
  const settings = context.settings;

  const workflowService = await context.service('workflowService');
  const workflowDraftService = await context.service('workflowDraftService');
  const workflowInstanceService = await context.service('workflowInstanceService');
  const workflowTriggerService = await context.service('workflowTriggerService');
  const workflowAssignmentService = await context.service('workflowAssignmentService');

  // ===============================================================
  //  POST /:id/v/:v/trigger (mounted to /api/workflows)
  // ===============================================================
  router.post(
    '/:id/v/:v/trigger',
    wrap(async (req, res) => {
      const id = req.params.id;
      const vStr = req.params.v;
      const input = _.get(req.body, 'input');
      const meta = _.get(req.body, 'meta', {});
      const requestContext = res.locals.requestContext;

      meta.workflowId = id;
      meta.workflowVer = parseInt(vStr, 10);
      meta.smWorkflow = settings.get('smWorkflow');

      const result = await workflowTriggerService.triggerWorkflow(requestContext, meta, input);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/v/:v/instances (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/:id/v/:v/instances',
    wrap(async (req, res) => {
      const id = req.params.id;
      const v = req.params.v;

      const result = await workflowInstanceService.list({ workflowId: id, workflowVer: v });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/v/:v/instances/:instanceId (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/:id/v/:v/instances/:instanceId',
    wrap(async (req, res) => {
      const instanceId = req.params.instanceId;

      const result = await workflowInstanceService.mustFindInstance({ id: instanceId });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/assignments (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/:id/assignments',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const id = req.params.id;

      const result = await workflowAssignmentService.listByWorkflow(requestContext, { workflowId: id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /drafts (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/drafts',
    wrap(async (_req, res) => {
      const requestContext = res.locals.requestContext;

      const result = await workflowDraftService.list(requestContext);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET / (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/',
    wrap(async (_req, res) => {
      const result = await workflowService.listVersions();
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /latest (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/latest',
    wrap(async (_req, res) => {
      const result = await workflowService.list();
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;

      const result = await workflowService.listVersions({ id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/latest (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/:id/latest',
    wrap(async (req, res) => {
      const id = req.params.id;

      const result = await workflowService.mustFindVersion({ id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/v/:v (mounted to /api/workflows)
  // ===============================================================
  router.get(
    '/:id/v/:v',
    wrap(async (req, res) => {
      const id = req.params.id;
      const v = req.params.v;

      const result = await workflowService.mustFindVersion({ id, v });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /:id/v/ (mounted to /api/workflows)
  // ===============================================================
  router.post(
    '/:id/v/',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const manifest = req.body;

      if (manifest.id !== id) throw boom.badRequest('The workflow ids do not match', true);

      const result = await workflowService.createVersion(requestContext, manifest);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /drafts (mounted to /api/workflows)
  // ===============================================================
  router.post(
    '/drafts',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const possibleBody = req.body;
      const result = await workflowDraftService.createDraft(requestContext, possibleBody);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /drafts/publish (mounted to /api/workflows)
  // ===============================================================
  router.post(
    '/drafts/publish',
    wrap(async (req, res) => {
      const requestContext = res.locals.requestContext;
      const draft = req.body;
      const result = await workflowDraftService.publishDraft(requestContext, draft);

      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  PUT /drafts/:id (mounted to /api/workflows)
  // ===============================================================
  router.put(
    '/drafts/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;
      const draft = req.body;

      if (draft.id !== id) throw boom.badRequest('The workflow draft ids do not match', true);

      const result = await workflowDraftService.updateDraft(requestContext, draft);
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  DELETE /drafts/:id (mounted to /api/workflows)
  // ===============================================================
  router.delete(
    '/drafts/:id',
    wrap(async (req, res) => {
      const id = req.params.id;
      const requestContext = res.locals.requestContext;

      await workflowDraftService.deleteDraft(requestContext, { id });
      res.status(200).json({});
    }),
  );

  return router;
}

module.exports = configure;
