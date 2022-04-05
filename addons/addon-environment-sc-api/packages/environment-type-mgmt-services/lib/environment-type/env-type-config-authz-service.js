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
const Service = require('@amzn/base-services-container/lib/service');

const { allow, deny, isDeny, allowIfActive } = require('@amzn/base-services/lib/authorization/authorization-utils');

class EnvTypeConfigAuthzService extends Service {
  async authorize(requestContext, { resource, action, effect, reason }, ...args) {
    let permissionSoFar = { effect };
    // if effect is "deny" already (due to any of the previous plugins returning "deny") then return "deny" right away
    if (isDeny(permissionSoFar)) return { resource, action, effect, reason };

    // Make sure the caller is active. This basic check is required irrespective of "action" so checking it here
    permissionSoFar = await allowIfActive(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    switch (action) {
      case 'use-config':
        return this.authorizeUseConfig(requestContext, { action }, ...args);
      default:
        // This authorizer does not know how to perform authorization for the specified action.
        // Return with the current authorization decision collected so far (from other plugins, if any)
        return { effect };
    }
  }

  // eslint-disable-next-line no-unused-vars
  async authorizeUseConfig(requestContext, { action }, envTypeConfig) {
    const { allowRoleIds, denyRoleIds, name } = envTypeConfig;
    const userRole = _.get(requestContext, 'principal.userRole');

    const denyPermission = deny(
      `You are not authorized to use configuration "${name}". Please contact your administrator.`,
      true,
    );

    if (_.includes(denyRoleIds, userRole)) {
      // explicit deny -- no need to check anything else just deny
      return denyPermission;
    }

    if (_.isEmpty(allowRoleIds) && _.isEmpty(denyRoleIds)) {
      // implicit deny -- no allowed or denied roles specified
      return denyPermission;
    }

    // If allowRoleIds are specified (i.e., if whitelist is specified or if mix of allowed and denied are both specified)
    // then allow if the user's role is in the allowed list. If user's role is specified in deny list then it would be
    // denied due to explicit deny check above
    // If no allowRoleIds are specified then it's blacklist case and deny only if the user's role is in the deny list
    if (!_.isEmpty(allowRoleIds) && !_.includes(allowRoleIds, userRole)) {
      return denyPermission;
    }

    return allow();
  }
}

module.exports = EnvTypeConfigAuthzService;
