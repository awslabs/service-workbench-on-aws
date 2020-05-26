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

  const stepTemplateService = await context.service('stepTemplateService');

  // ===============================================================
  //  GET / (mounted to /api/step-templates)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const result = await stepTemplateService.listVersions();
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /latest (mounted to /api/step-templates)
  // ===============================================================
  router.get(
    '/latest',
    wrap(async (req, res) => {
      const result = await stepTemplateService.list();
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id (mounted to /api/step-templates)
  // ===============================================================
  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = req.params.id;

      const result = await stepTemplateService.listVersions({ id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/latest (mounted to /api/step-templates)
  // ===============================================================
  router.get(
    '/:id/latest',
    wrap(async (req, res) => {
      const id = req.params.id;

      const result = await stepTemplateService.mustFindVersion({ id });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  GET /:id/v/:v (mounted to /api/step-templates)
  // ===============================================================
  router.get(
    '/:id/v/:v',
    wrap(async (req, res) => {
      const id = req.params.id;
      const v = req.params.v;

      const result = await stepTemplateService.mustFindVersion({ id, v });
      res.status(200).json(result);
    }),
  );

  // ===============================================================
  //  POST /:id/v/:v/validate (mounted to /api/step-templates)
  // ===============================================================
  router.post(
    '/:id/v/:v/validate',
    wrap(async (req, res) => {
      const {
        params: { id, v },
        body: config = {},
      } = req;

      const result = await stepTemplateService.mustValidateVersion({ id, v, config });
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
