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
  const userService = await context.service('userService');
  // ===============================================================
  //  A middleware
  // ===============================================================
  // Ensure the logged in user is Active before allowing this route access
  router.all(
    '*',
    wrap(async (req, res, next) => {
      const requestContext = res.locals.requestContext;

      const isActive = await userService.isCurrentUserActive(requestContext);
      if (!isActive) {
        // Do not allow any access if the logged in user is marked inactive in the system
        throw boom.unauthorized('Inactive user', true);
      }
      next();
    }),
  );

  return router;
}

module.exports = configure;
