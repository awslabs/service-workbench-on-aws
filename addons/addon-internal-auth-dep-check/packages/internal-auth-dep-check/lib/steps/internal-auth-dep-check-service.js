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
const CompositeError = require('../utils/composite-error');

const settingKeys = {
  keyPairsTableName: 'dbKeyPairs',
  usersTableName: 'dbUsers',
  studiesTableName: 'dbStudies',
  studyPermissionsTableName: 'dbStudyPermissions',
  environemntsTableName: 'dbEnvironmentsSc',
};

class InternalAuthDepCheckService extends Service {
  constructor() {
    super();
    this.dependency(['dbService', 'userService']);
  }

  async init() {
    await super.init();
    // Setup services and SDK clients
    this.dbService = await this.service('dbService');
    this.userService = await this.service('userService');
    this.dynamoDB = this.dbService.helper;
  }

  // method runs during pre deployment step
  async execute() {
    // Keep track of resources blocking upgrade
    const blockers = {};
    const usersTable = this.settings.get(settingKeys.usersTableName);

    // check not fresh install
    try {
      await this.dbService.dynamoDb.describeTable({ TableName: usersTable }).promise();
    } catch (e) {
      if (e.code === 'ResourceNotFoundException') {
        this.log.info('This is first time deployment, no resources exist.');
        return;
      }
      throw new Error(
        `Error in pre-deployment internal auth check, can not describe backend table: ${usersTable}, message: ${e.message}`,
      );
    }

    // get necessary lists
    const {
      listOfInternalUsers,
      listOfInternalUsernames,
      activeUserBlockers,
      internalUserProjectBlockers,
    } = await this._listInternalUsers();

    // Verify internal users are not linked to projects
    blockers.projects = internalUserProjectBlockers;

    // Verify all Workspaces linked to internal users have been terminated
    const workspaceBlockers = await this.verifyInternalUserWorkspacesAreTerminated(
      listOfInternalUsers,
      listOfInternalUsernames,
    );
    blockers.workspace = workspaceBlockers;

    // Verify all SSH keys linked to internal users have been deactivated
    const sshKeyBlockers = await this.verifyNoInternalUserSSHKey(listOfInternalUsers, listOfInternalUsernames);
    blockers.sshKeys = sshKeyBlockers;

    // Verify internal users are not linked to Org Studies
    const orgStudiesBlockers = await this.verifyNoInternalUserOrgStudies(listOfInternalUsers, listOfInternalUsernames);
    blockers.orgStudies = orgStudiesBlockers;

    // LASTLY, verify all internal users (including root) are deactivated
    blockers.activeUsers = activeUserBlockers;

    if (Object.keys(blockers).length > 0) {
      const compositeError = this.createBlockerReport(blockers);
      if (compositeError.hasErrors) throw compositeError;
    }
  }

  createBlockerReport(blockers) {
    const compositeError = new CompositeError();
    Object.keys(blockers).forEach(resource => {
      blockers[resource].forEach(item => {
        compositeError.addError(this.boom.badRequest(item, true));
      });
    });
    return compositeError;
  }

  async verifyInternalUserWorkspacesAreTerminated(listOfInternalUsers, listOfInternalUsernames) {
    const blockers = [];
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

    result
      .filter(item => listOfInternalUsers.includes(item.createdBy))
      .forEach(item => {
        blockers.push(`${item.id} owned by user ${item.createdBy} (${listOfInternalUsernames[item.createdBy]})`);
      });

    if (blockers.length > 0) {
      blockers.unshift('Terminate the following workspaces owned by internal users:');
    }

    return blockers;
  }

  async verifyNoInternalUserSSHKey(listOfInternalUsers, listOfInternalUsernames) {
    const blockers = [];
    const table = this.settings.get(settingKeys.keyPairsTableName);

    // Scan for active ssh keys
    const result = await this.dynamoDB
      .scanner()
      .table(table)
      .names({ '#s': 'status' })
      .values({ ':a': 'active' })
      .filter('#s = :a')
      .projection(['uid', 'id'])
      .scan();

    result
      .filter(item => listOfInternalUsers.includes(item.uid))
      .forEach(item => {
        blockers.push(`${item.id} owned by user ${item.uid} (${listOfInternalUsernames[item.uid]})`);
      });

    if (blockers.length > 0) {
      blockers.unshift('Deactivate the following SSH Keys owned by internal users:');
    }

    return blockers;
  }

  async _listInternalUsers() {
    const activeUserBlockers = [];
    const internalUserProjectBlockers = [];
    const table = this.settings.get(settingKeys.usersTableName);

    // Scan for internal authentication users
    const result = await this.dynamoDB
      .scanner()
      .table(table)
      .names({ '#a': 'authenticationProviderId' })
      .values({ ':i': 'internal' })
      .filter('#a = :i')
      .projection(['uid', 'status', 'projectId'])
      .scan();

    const listOfInternalUsers = _.uniq(result.map(item => item.uid));
    const listOfInternalUsernames = await this.getUserNames(listOfInternalUsers);
    result
      .filter(item => item.status === 'active')
      .forEach(item => {
        activeUserBlockers.push(`${item.uid} (${listOfInternalUsernames[item.uid]}) is still active`);
        if (!_.isEmpty(item.projectId)) {
          internalUserProjectBlockers.push(
            `${item.projectId.flat()} associated to user ${item.uid} (${listOfInternalUsernames[item.uid]})`,
          );
        }
      });

    if (activeUserBlockers.length > 0) {
      activeUserBlockers.unshift('Deactivate the following internal users:');
    }

    if (internalUserProjectBlockers.length > 0) {
      internalUserProjectBlockers.unshift('Disassociate the following projects from the following internal users:');
    }

    return { listOfInternalUsers, listOfInternalUsernames, activeUserBlockers, internalUserProjectBlockers };
  }

  async verifyNoInternalUserOrgStudies(listOfInternalUsers, listOfInternalUsernames) {
    const blockers = [];
    const listOfOrganizationStudyIds = await this._listOrganizationStudyIds();
    for (let i = 0; i < listOfOrganizationStudyIds.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { listOfOrganizationStudyUsers, adminUsers } = await this._getPermissionsForStudy(
        listOfOrganizationStudyIds[i],
        listOfInternalUsernames,
      );
      for (let j = 0; j < listOfOrganizationStudyUsers.length; j += 1) {
        if (listOfInternalUsers.includes(listOfOrganizationStudyUsers[j])) {
          blockers.push(
            `Found Org Study with internal user permissions: user ${listOfOrganizationStudyUsers[j]} (${
              listOfInternalUsernames[listOfOrganizationStudyUsers[j]]
            }) associated with study ${
              listOfOrganizationStudyIds[i]
            }. Contact admin users ${adminUsers} for assistance.`,
          );
        }
      }
    }

    if (blockers.length > 0) {
      blockers.unshift('Disassociate the following organizational studies with internal users:');
    }

    return blockers;
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

  async _getPermissionsForStudy(studyId, listOfInternalUsernames) {
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

    const adminUsers = result
      .map(item => item.adminUsers)
      .flat()
      .map(uid => listOfInternalUsernames[uid]);

    return { listOfOrganizationStudyUsers, adminUsers };
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

  async getUserNames(listOfInternalUsers) {
    const listOfInternalUsernames = {};
    await Promise.all(
      listOfInternalUsers.map(async uid => {
        const currentUsername = await this.userService.findUser({ uid, fields: 'username' });
        listOfInternalUsernames[uid] = currentUsername.username;
      }),
    );

    return listOfInternalUsernames;
  }
}

// export the service
module.exports = InternalAuthDepCheckService;
