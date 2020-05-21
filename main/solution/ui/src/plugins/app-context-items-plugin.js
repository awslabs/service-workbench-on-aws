/**
 * Registers your app context items to the given appContext.
 *
 * @param appContext An instance of application context containing various application level objects such as various
 * MobX stores. This is a live reference. Use this function to register context items by setting them directly on
 * the given "appContext" reference.  If you need access to the pluginRegistry, you can get it from appContext
 */
// eslint-disable-next-line no-unused-vars
function registerAppContextItems(appContext) {
  // This is where you can
  // 1. register your app context items, such as your own MobX stores. To register your items
  //
  //    myStore.registerAppContextItems(appContext); // The "myStore" needs to have a method "registerContextItems"
  //                                                 // with implementation of adding itself to the given "appContext"
  //
  // 2. modify any existing items
  //
  //       appContext.itemYouWantToModify = newItem;
  //
  // 3. delete any existing item,
  //
  //      delete appContext.itemYouWantToRemoveFromContext; OR
  //      appContext.itemYouWantToRemoveFromContext = undefined;
  //
  // TODO: Register additional custom context items (such as your custom MobX stores) here
}

const plugin = {
  registerAppContextItems,
};

export default plugin;
