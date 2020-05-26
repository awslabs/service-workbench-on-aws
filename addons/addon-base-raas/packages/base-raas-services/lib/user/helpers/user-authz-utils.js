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
const { allow, deny } = require('@aws-ee/base-services/lib/authorization/authorization-utils');

function allowIfHasRole(requestContext, { action, resource }, allowedUserRoles) {
  const userRole = _.get(requestContext, 'principal.userRole');
  if (!_.includes(allowedUserRoles, userRole)) {
    const resourceDisplayName = resource || 'resource';
    return deny(
      `Cannot ${action} ${resourceDisplayName}. The user's role "${userRole}" is not allowed to ${action} ${resourceDisplayName}`,
      false,
    );
  }
  return allow();
}

module.exports = {
  allowIfHasRole,
};
