import { types, applySnapshot, getEnv } from 'mobx-state-tree';
import UserIdentifier from '@aws-ee/base-ui/dist/models/users/UserIdentifier';

const KeyValuePair = types.model('KeyValuePair', {
  key: '',
  value: '',
});

// ====================================================================================================================================
// EnvTypeConfig
// ====================================================================================================================================
const EnvTypeConfig = types
  .model('EnvTypeConfig', {
    id: types.identifier,
    name: '',
    desc: '',
    estimatedCostInfo: '',
    allowRoleIds: types.optional(types.array(types.string), []),
    denyRoleIds: types.optional(types.array(types.string), []),
    params: types.optional(types.array(KeyValuePair), []),
    tags: types.optional(types.array(KeyValuePair), []),
    createdAt: '',
    createdBy: types.optional(UserIdentifier, {}),
    updatedAt: '',
    updatedBy: types.optional(UserIdentifier, {}),

    // flag indicating if the env type config is allowed to be used
    // defaulting this to true as the API only returns those env type configs that are usable
    // except for admins when include=all is passed in the query param, it returns all env type configs
    // including the ones the user is not allowed to use when launching an environment
    allowedToUse: types.optional(types.boolean, true),
  })
  .actions(self => ({
    setEnvTypeConfig(envTypeConfig) {
      applySnapshot(self, envTypeConfig);
    },
  }))
  .views(self => ({
    get descHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.desc);
    },
    get estimatedCostInfoHtml() {
      const showdown = getEnv(self).showdown;
      return showdown.convert(self.estimatedCostInfo);
    },
  }));

export default EnvTypeConfig;
export { EnvTypeConfig };
