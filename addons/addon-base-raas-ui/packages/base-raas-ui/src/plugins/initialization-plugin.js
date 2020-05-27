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

/**
 * This is where we run the post initialization logic that is specific to RaaS.
 *
 * @param payload A free form object. This function expects a property named 'tokenInfo' to be available on the payload object.
 * @param appContext An application context object containing various Mobx Stores, Models etc.
 *
 * @returns {Promise<void>}
 */
async function postInit(payload, appContext) {
  const tokenNotExpired = _.get(payload, 'tokenInfo.status') === 'notExpired';
  if (!tokenNotExpired) return; // Continue only if we have a token that is not expired

  const { userStore, usersStore, awsAccountsStore, userRolesStore, indexesStore, projectsStore } = appContext;

  // TODO: Load these stores as needed instead of on startup
  if (userStore.user.status === 'active') {
    await Promise.all([
      usersStore.load(),
      awsAccountsStore.load(),
      userRolesStore.load(),
      indexesStore.load(),
      projectsStore.load(),
    ]);
  }
}

const plugin = {
  postInit,
};

export default plugin;
