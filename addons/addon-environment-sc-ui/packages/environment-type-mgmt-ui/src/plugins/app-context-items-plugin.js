import * as envTypesStore from '../models/environment-types/EnvTypesStore';
import * as envTypeCandidatesStore from '../models/environment-types/EnvTypeCandidatesStore';

// eslint-disable-next-line no-unused-vars
function registerAppContextItems(appContext) {
  envTypesStore.registerContextItems(appContext);
  envTypeCandidatesStore.registerContextItems(appContext);
}

// eslint-disable-next-line no-unused-vars
function postRegisterAppContextItems(appContext) {
  // No impl at this level
}

const plugin = {
  registerAppContextItems,
  postRegisterAppContextItems,
};

export default plugin;
