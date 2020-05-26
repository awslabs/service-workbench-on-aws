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

// const authProviderConstants = require('@aws-ee/base-services/lib/authentication-providers/constants')
//   .authenticationProviders;
// const _ = require('lodash');

async function configure(context) {
  const router = context.router();
  const wrap = context.wrap;
  // const boom = context.boom;
  const [userRolesService] = await context.service(['userRolesService']);

  // ===============================================================
  //  GET / (mounted to /api/user-roles)
  // ===============================================================
  router.get(
    '/',
    wrap(async (req, res) => {
      const userRoles = await userRolesService.list();
      res.status(200).json(userRoles);
    }),
  );

  return router;
}

module.exports = configure;
