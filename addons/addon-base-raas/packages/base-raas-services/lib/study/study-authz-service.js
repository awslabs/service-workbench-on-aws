/* eslint-disable no-await-in-loop */
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
const Service = require('@aws-ee/base-services-container/lib/service');
const { allow, deny, isDeny, allowIfActive } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const { isAdmin } = require('../helpers/is-role');
const { hasAccess } = require('./helpers/study-permissions');

class StudyAuthzService extends Service {
  async authorize(requestContext, { resource, action, effect, reason }, ...args) {
    let permissionSoFar = { effect };
    // if effect is "deny" already (due to any of the previous plugins returning "deny") then return "deny" right away
    if (isDeny(permissionSoFar)) return { resource, action, effect, reason };

    // Make sure the caller is active. This basic check is required irrespective of "action" so checking it here
    permissionSoFar = await allowIfActive(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // The actions with "-sc" suffix are for env operations using
    // AWS Service Catalog Products/Versions
    switch (action) {
      case 'get-study-permissions':
        return this.allowIfAdminOrHasAccess(requestContext, { action }, ...args);
      default:
        // This authorizer does not know how to perform authorization for the specified action.
        // Return with the current authorization decision collected so far (from other plugins, if any)
        return { effect };
    }
  }

  async allowIfAdminOrHasAccess(requestContext, _ignore, { studyPermissionsEntity = {} } = {}) {
    if (isAdmin(requestContext)) return allow();
    const uid = _.get(requestContext, 'principalIdentifier.uid');

    if (hasAccess(uid, studyPermissionsEntity)) return allow();

    return deny('You do not have permission to view the study access information');
  }
}

module.exports = StudyAuthzService;
