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

const {
  allow,
  deny,
  isDeny,
  allowIfActive,
  allowIfCurrentUserOrAdmin,
} = require('@aws-ee/base-services/lib/authorization/authorization-utils');

const { allowIfHasRole } = require('../user/helpers/user-authz-utils');

class EnvironmentAuthzService extends Service {
  constructor() {
    super();
    this.dependency(['projectService']);
  }

  async authorize(requestContext, { resource, action, effect, reason }, ...args) {
    let permissionSoFar = { effect };
    // if effect is "deny" already (due to any of the previous plugins returning "deny") then return "deny" right away
    if (isDeny(permissionSoFar)) return { resource, action, effect, reason };

    // Make sure the caller is active. This basic check is required irrespective of "action" so checking it here
    permissionSoFar = await allowIfActive(requestContext, { action });
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    switch (action) {
      case 'get':
      case 'update':
      case 'delete':
        return this.allowIfUserHasAccess(requestContext, { action }, ...args);
      case 'list':
        return this.authorizeList(requestContext, { action }, ...args);
      case 'create':
        return this.authorizeCreate(requestContext, { action }, ...args);
      case 'create-external':
        return this.authorizeCreateExternal(requestContext, { action }, ...args);
      default:
        // This authorizer does not know how to perform authorization for the specified action.
        // Return with the current authorization decision collected so far (from other plugins, if any)
        return { effect };
    }
  }

  async allowIfUserHasAccess(requestContext, { action }, environment) {
    const envCreator = environment.createdBy;
    if (_.isEmpty(envCreator)) {
      return deny(`Cannot ${action} the workspace. Workspace creator information is not available`);
    }
    // Allow if the caller is the environment creator (owner) or admin
    let permissionSoFar = await allowIfCurrentUserOrAdmin(requestContext, { action }, envCreator);

    if (isDeny(permissionSoFar)) {
      const isProjectAdmin = await this.isEnvironmentProjectAdmin(requestContext, environment);
      const isSharedWithUser = await this.isSharedWithUser(requestContext, environment);
      if (isProjectAdmin || isSharedWithUser) {
        permissionSoFar = allow();
      } else {
        return permissionSoFar; // return if denying
      }
    }

    // Even if the user is owner (creator) of the env his/her role may have changed (e.g., to guest or internal-guest)
    // that may not allow it to perform the specified action on the environment (after the environment was created initially)
    permissionSoFar = allowIfHasRole(requestContext, { action, resource: 'environment' }, [
      'admin',
      'researcher',
      'external-researcher',
    ]);
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    return permissionSoFar;
  }

  async authorizeList(requestContext, { action }) {
    // Make sure the current user role allows listing an environment
    const permissionSoFar = allowIfHasRole(requestContext, { action, resource: 'environment' }, [
      'admin',
      'researcher',
      'external-researcher',
    ]);
    return permissionSoFar;
  }

  async authorizeCreateExternal(requestContext, { action }, environment) {
    // Make sure the current user role allows creating an external environment
    const permissionSoFar = allowIfHasRole(requestContext, { action, resource: 'environment' }, [
      'external-researcher',
    ]);
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // Make sure the projectId is not specified, as external environments do not belong to any projects
    const projectId = _.get(environment, 'projectId');
    if (projectId) {
      return deny(`Cannot ${action} external workspace. External workspace cannot be associated to a project`, false);
    }
    return allow();
  }

  async authorizeCreate(requestContext, { action }, environment) {
    // Make sure the current user role allows creating an environment
    const permissionSoFar = allowIfHasRole(requestContext, { action, resource: 'environment' }, [
      'admin',
      'researcher',
    ]);
    if (isDeny(permissionSoFar)) return permissionSoFar; // return if denying

    // Make sure the user has access to the project
    const projectId = _.get(environment, 'projectId');
    const projectIds = _.get(requestContext, 'principal.projectId'); // The 'projectId' field on principal is actually an array of project ids
    if (!projectId) {
      return deny(`Cannot ${action} workspace. No project is specified`, true);
    }
    if (!_.includes(projectIds, projectId)) {
      return deny(
        `Cannot ${action} workspace. You do not have access to project "${projectId}". Please contact your administrator.`,
        true,
      );
    }
    return allow();
  }

  async isEnvironmentProjectAdmin(requestContext, environment) {
    const ProjectService = await this.service('projectService');
    const project = await ProjectService.find(requestContext, { id: environment.projectId });
    if (!project) {
      // eslint-disable-next-line no-console
      console.error(`could not find project in isEnvironmentProjectAdmin: [${environment.projectId}]`);
      return false;
    }
    const projectAdmins = project.projectAdmins || [];
    return projectAdmins.some(projectAdmin => {
      const { username: projectUsername, ns: projectNs } = projectAdmin;
      const { username: requestUsername, ns: requestNs } = requestContext.principal;
      return projectUsername === requestUsername && projectNs === requestNs;
    });
  }

  async isSharedWithUser(requestContext, environment) {
    const ProjectService = await this.service('projectService');
    const project = await ProjectService.find(requestContext, { id: environment.projectId });
    if (!project) {
      // eslint-disable-next-line no-console
      console.error(`could not find project in isSharedWithUser: [${environment.projectId}]`);
      return false;
    }
    const sharedWithUsers = environment.sharedWithUsers || [];
    return sharedWithUsers.some(sharedWithUser => {
      const { username: projectUsername, ns: projectNs } = sharedWithUser;
      const { username: requestUsername, ns: requestNs } = requestContext.principal;
      return projectUsername === requestUsername && projectNs === requestNs;
    });
  }
}
module.exports = EnvironmentAuthzService;
