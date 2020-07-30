import * as keyPairsStore from '../models/key-pairs/KeyPairsStore';

function registerAppContextItems(appContext) {
  keyPairsStore.registerContextItems(appContext);
}

// // eslint-disable-next-line no-unused-vars
// function postRegisterAppContextItems(appContext) {
//   // No impl at this level
// }

const plugin = {
  registerAppContextItems,
  // postRegisterAppContextItems,
};

export default plugin;
