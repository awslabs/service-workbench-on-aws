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

const RequestContext = require('@aws-ee/base-services-container/lib/request-context');

/**
 * A helper function that helps create requestContext for system users.
 * Most of the services accept "requestContext" argument which provides context about the service call (such as who is the caller of the service i.e., the "principal" etc)
 * In case of system calls (i.e., calls not initiated by any "principal" but result of some system operation such as execution of post-deployment steps),
 * the requestContext should contain information about the implicit "system" user.
 * This method returns this "requestContext" that can be passed to services for system calls.
 *
 * @returns {Service}
 */
function getSystemRequestContext() {
  const ctx = new RequestContext();

  const systemUid = '_system_';
  const systemUsername = '_system_';
  const systemUserNamespace = '_system_';

  ctx.authenticated = true;
  ctx.principal = {
    uid: systemUid,
    username: systemUsername,
    ns: systemUserNamespace,
    isAdmin: true,
    userRole: 'admin',
    status: 'active',
  };
  ctx.principalIdentifier = {
    uid: systemUid,
  };

  return ctx;
}

module.exports = {
  getSystemRequestContext,
};
