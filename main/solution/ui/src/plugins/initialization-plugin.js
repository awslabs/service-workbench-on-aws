/**
 * If you need to add some global UI initialization logic that is specific to the solution, you can do it here. However,
 * It is unlikely that you will need to do so because the base-ui addon takes care of the most common initialization
 * logic needed.
 *
 * @param payload A free form object. Use this object to add any properties that you need to pass to the App model
 * when it is being initialized. The base-ui addon, makes a property named 'tokenInfo' available on this payload object.
 * @param appContext An application context object containing various Mobx Stores, Models etc.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function init(payload, appContext) {
  // Write any solution specific initialization logic.
}

// eslint-disable-next-line no-unused-vars
async function postInit(payload, appContext) {
  // Write any solution specific post initialization logic, such as loading stores.
}

const plugin = {
  init,
  postInit,
};

export default plugin;
