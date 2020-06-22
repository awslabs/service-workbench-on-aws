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

/**
 * This a sample controller, take a look at the file ./plugins/routes-plugin.js
 * for an example of how to register this controller
 */
async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  const boom = context.boom; // eslint-disable-line no-unused-vars
  const settings = context.settings; // eslint-disable-line no-unused-vars

  // ===============================================================
  //  GET / (mounted to /api/hello)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const helloService = await context.service('helloService');
      const requestContext = res.locals.requestContext;
      const result = await helloService.getHelloMessages(requestContext /* , rawData */);
      res.status(200).json(result);
    }),
  );

  return router;
}

module.exports = configure;
