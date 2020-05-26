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

import _ from 'lodash';
import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { consolidateToMap } from '@aws-ee/base-ui/dist/helpers/utils';
import { getUserRoles } from '../../helpers/api';
import { UserRole } from './UserRole';

// ==================================================================
// UserRolesStore
// ==================================================================
const UserRolesStore = BaseStore.named('UserRolesStore')
  .props({
    userRoles: types.optional(types.map(UserRole), {}),
  })

  .actions(self => {
    // save the base implementation of cleanup
    const superCleanup = self.cleanup;

    return {
      async doLoad() {
        const userRoles = (await getUserRoles()) || [];
        self.runInAction(() => {
          consolidateToMap(self.userRoles, userRoles, (exiting, newItem) => {
            exiting.setUserRole(newItem);
          });
        });
      },

      cleanup: () => {
        superCleanup();
      },
    };
  })

  .views(self => ({
    get list() {
      const result = [];
      // converting map self.users to result array
      self.userRoles.forEach(userRole => result.push(userRole));
      return result;
    },
    get dropdownOptions() {
      const result = [];
      // converting map self.users to result array
      self.userRoles.forEach(userRole => {
        const role = {};
        role.key = userRole.id;
        role.value = userRole.id;
        role.text = userRole.id;
        result.push(role);
      });
      return result;
    },

    isInternalUser(userRoleId) {
      return _.toLower(self.getUserType(userRoleId)) === 'internal';
    },

    getUserType(userRoleId) {
      const found = self.userRoles.get(userRoleId);
      return found ? found.userType : '';
    },
  }));

function registerContextItems(appContext) {
  appContext.userRolesStore = UserRolesStore.create({}, appContext);
}

export { UserRolesStore, registerContextItems };
