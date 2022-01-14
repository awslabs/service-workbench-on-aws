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

const settingKeys = {
  keyPairsTableName: 'dbKeyPairs',
  usersTableName: 'dbUsers',
  projectsTableName: 'dbProjects',
  studiesTableName: 'dbStudies',
  studyPermissionsTableName: 'dbStudyPermissions',
  environemntsTableName: 'dbEnvironmentsSc',
};

class InternalAuthDepCheckService extends Service {
  constructor() {
    super();
    this.dependency(['dbService']);
  }

  async init() {
    await super.init();
    // Setup services and SDK clients
    this.dbService = await this.service('dbService');
    this.dynamoDB = this.dbService.helper;
  }

  // method runs during pre deployment step
  async execute() {
    // get necessary lists
    const { listOfInternalUsers, listOfInternalStatuses } = await this._listInternalUsers();

    // Verify all Workspaces linked to internal users have been terminated
    if (!(await this.verifyInternalUserWorkspacesAreTerminated(listOfInternalUsers))) {
      throw this.boom.badRequest('Please terminate all internal user-owned workspaces before upgrading');
    }

    // Verify all SSH keys linked to internal users have been deleted
    if (!(await this.verifyNoInternalUserSSHKey(listOfInternalUsers))) {
      throw this.boom.badRequest('Please deactive all SSH Keys linked to internal users before upgrading');
    }

    // Verify internal users are not linked to the following resources: Projects, Org Studies, DS Accounts
    if (!(await this.verifyNoInternalUserProjects(listOfInternalUsers))) {
      throw this.boom.badRequest('Please deassociate all internal users from Projects before upgrading');
    }
    if (!(await this.verifyNoInternalUserOrgStudies(listOfInternalUsers))) {
      throw this.boom.badRequest('Please deassociate all internal users from Organization Studies before upgrading');
    }

    // Verify all internal users (including root) are deactivated
    if (!(await this.verifyNoActiveInternalUsers(listOfInternalStatuses))) {
      throw this.boom.badRequest('Please deactive all Internal IdP users before upgrading');
    }
  }

  async verifyInternalUserWorkspacesAreTerminated(listOfInternalUsers) {
    const table = this.settings.get(settingKeys.environemntsTableName);

    // Scan for any environments that are not in a failed or terminated state
    const result = await this.dynamoDB
      .scanner()
      .table(table)
      .names({ '#s': 'status' })
      .values({ ':c': 'COMPLETED', ':p': 'PENDING', ':start': 'STARTING', ':stop': 'STOPPING', ':t': 'TERMINATING' })
      .filter('#s = :c OR #s = :p OR #s = :start OR #s = :stop OR #s = :t')
      .projection(['id', 'createdBy'])
      .scan();

    const listOfNonTerminatedWorkspaces = _.uniq(
      result.filter(item => listOfInternalUsers.includes(item.createdBy)).map(item => item.id),
    );

    if (listOfNonTerminatedWorkspaces.length > 0) {
      this.log.error(`Found at least one workspace that is not terminated: ${listOfNonTerminatedWorkspaces}`);
      return false;
    }

    return true;
  }

  async verifyNoInternalUserSSHKey(listOfInternalUsers) {
    const table = this.settings.get(settingKeys.keyPairsTableName);

    // Scan for active ssh keys
    const result = await this.dynamoDB
      .scanner()
      .table(table)
      .names({ '#s': 'status' })
      .values({ ':a': 'active' })
      .filter('#s = :a')
      .projection('uid')
      .scan();

    const listOfUsers = _.uniq(result.filter(item => listOfInternalUsers.includes(item.uid)).map(item => item.uid));

    if (listOfUsers.length > 0) {
      this.log.error(`Found at least one user with active SSH key: ${listOfUsers}`);
      return false;
    }
    return true;
  }

  async _listInternalUsers() {
    const table = this.settings.get(settingKeys.usersTableName);

    // Scan for internal authentication users
    const result = await this.dynamoDB
      .scanner()
      .table(table)
      .names({ '#a': 'authenticationProviderId' })
      .values({ ':i': 'internal' })
      .filter('#a = :i')
      .projection(['uid', 'status'])
      .scan();

    const listOfInternalUsers = _.uniq(result.map(item => item.uid));
    const listOfInternalStatuses = _.uniq(result.map(item => item.status));

    return { listOfInternalUsers, listOfInternalStatuses };
  }

  async verifyNoActiveInternalUsers(listOfInternalStatuses) {
    if (listOfInternalStatuses.includes('active')) {
      this.log.error(`Found an least one active internal user`);
      return false;
    }
    return true;
  }

  async verifyNoInternalUserProjects(listOfInternalUsers) {
    const table = this.settings.get(settingKeys.projectsTableName);

    // Scan for project admins
    const result = await this.dynamoDB
      .scanner()
      .table(table)
      .projection('projectAdmins')
      .scan();

    const listOfProjectAdmins = _.uniq(
      result
        .map(item => item.projectAdmins)
        .flat()
        .filter(item => listOfInternalUsers.includes(item)),
    );

    if (listOfProjectAdmins.length > 0) {
      this.log.error(`Found at least one user associated with a project: ${listOfProjectAdmins}`);
      return false;
    }

    return true;
  }

  async verifyNoInternalUserOrgStudies(listOfInternalUsers) {
    const listOfOrganizationStudyIds = await this._listOrganizationStudyIds();
    for (let i = 0; i < listOfOrganizationStudyIds.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const listOfOrganizationStudyUsers = await this._getPermissionsForStudy(listOfOrganizationStudyIds[i]);
      for (let j = 0; j < listOfOrganizationStudyUsers.length; j += 1) {
        if (listOfInternalUsers.includes(listOfOrganizationStudyUsers[j])) {
          this.log.error(
            `Found Org Study with internal user permissions: user ${listOfOrganizationStudyUsers[j]} associated with study ${listOfOrganizationStudyIds[i]}`,
          );
          return false;
        }
      }
    }
    for (let i = 0; i < listOfInternalUsers.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const listOfInternalUsersStudies = await this._getPermissionsForUser(listOfInternalUsers[i]);
      for (let j = 0; j < listOfInternalUsersStudies.length; j += 1) {
        if (listOfOrganizationStudyIds.includes(listOfInternalUsersStudies[j])) {
          this.log.error(
            `Found Org Study with internal user permissions: user ${listOfInternalUsers[i]} associated with study ${listOfInternalUsersStudies[j]}`,
          );
          return false;
        }
      }
    }
    return true;
  }

  async _listOrganizationStudyIds() {
    const table = this.settings.get(settingKeys.studiesTableName);

    // Scan for Organization studies
    const result = await this.dynamoDB
      .scanner()
      .table(table)
      .names({ '#c': 'category' })
      .values({ ':o': 'Organization' })
      .filter('#c = :o')
      .projection('id')
      .scan();

    const listOfOrganizationStudyIds = _.uniq(result.map(item => item.id));

    return listOfOrganizationStudyIds;
  }

  async _getPermissionsForStudy(studyId) {
    const table = this.settings.get(settingKeys.studyPermissionsTableName);

    // Query Study Id for permissions
    const result = await this.dynamoDB
      .query()
      .table(table)
      .key('id', `Study:${studyId}`)
      .projection(['adminUsers', 'readonlyUsers', 'readwriteUsers', 'writeonlyUsers'])
      .query();

    const listOfOrganizationStudyUsers = _.uniq(
      result.map(item => [item.adminUsers, item.readonlyUsers, item.readwriteUsers, item.writeonlyUsers].flat()).flat(),
    );

    return listOfOrganizationStudyUsers;
  }

  async _getPermissionsForUser(userId) {
    const table = this.settings.get(settingKeys.studyPermissionsTableName);

    // Query User Id for access
    const result = await this.dynamoDB
      .query()
      .table(table)
      .key('id', `User:${userId}`)
      .projection(['adminAccess', 'readonlyAccess', 'writeonlyAccess', 'readwriteAccess'])
      .query();

    const listOfInternalUsersStudies = _.uniq(
      result
        .map(item => [item.adminAccess, item.readonlyAccess, item.writeonlyAccess, item.readwriteAccess].flat())
        .flat(),
    );

    return listOfInternalUsersStudies;
  }
}

// export the service
module.exports = InternalAuthDepCheckService;
