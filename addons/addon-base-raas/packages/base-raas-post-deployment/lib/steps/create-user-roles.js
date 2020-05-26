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
const { getSystemRequestContext } = require('@aws-ee/base-services/lib/helpers/system-context');

const userRoleItems = [
  {
    id: 'admin', // Don't delete this; the root is created with this role
    description: 'Administrator',
    userType: 'INTERNAL',
  },
  {
    id: 'guest', // Don't delete this; external self-registered users start as this
    description: 'External Guest',
    userType: 'EXTERNAL',
  },
  {
    id: 'internal-guest', // Don't delete this
    description: 'Internal Guest',
    userType: 'INTERNAL',
  },
  {
    id: 'researcher',
    description: 'Internal Researcher',
    userType: 'INTERNAL',
  },
  {
    id: 'external-researcher',
    description: 'External Researcher',
    userType: 'EXTERNAL',
  },
];

const settingKeys = {
  enableExternalResearchers: 'enableExternalResearchers',
};

class CreateUserRolesService extends Service {
  constructor() {
    super();
    this.dependency(['userRolesService', 'aws']);
  }

  async createUserRoles() {
    const [userRolesService] = await this.service(['userRolesService']);

    const enableExternalResearchers = this.settings.optionalBoolean(settingKeys.enableExternalResearchers, false);
    const disabledRoles = enableExternalResearchers ? [] : [{ id: 'external-researcher' }];
    const rolesToCreate = _.differenceBy(userRoleItems, disabledRoles, 'id');
    const requestContext = getSystemRequestContext();

    const creationPromises = rolesToCreate.map(async role => {
      try {
        // check if the userRole already exists, do not create or update the item info
        const userRole = await userRolesService.find(requestContext, { id: role.id });
        if (!userRole) {
          await userRolesService.create(requestContext, role);
          this.log.info({ message: `Created user role ${role.id}`, userRole: role });
        }
      } catch (err) {
        if (err.code === 'alreadyExists') {
          // The user role already exists. Nothing to do.
          this.log.info(`The userRole ${role.id} already exists. Did NOT overwrite that userRole's information.`);
        } else {
          // In case of any other error let it bubble up
          throw err;
        }
      }
    });
    await Promise.all(creationPromises);

    // Make sure there are no disabled roles in db.
    // This can happen if the solution was deployed first with the roles enabled but then re-deployed after disabling
    // certain roles
    await this.deleteRoles(requestContext, disabledRoles);

    this.log.info(`Finished creating user roles`);
  }

  async deleteRoles(requestContext, roles) {
    const [userRolesService] = await this.service(['userRolesService']);
    const deletionPromises = roles.map(async role => {
      try {
        await userRolesService.delete(requestContext, { id: role.id });
      } catch (err) {
        // The user role does not exist. Nothing to delete in that case
        if (err.code !== 'notFound') {
          // In case of any other error let it bubble up
          throw err;
        }
      }
    });
    return Promise.all(deletionPromises);
  }

  async execute() {
    return this.createUserRoles();
  }
}

module.exports = CreateUserRolesService;
