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
