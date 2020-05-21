import { types } from 'mobx-state-tree';

import ConfigurationEditor from '../configuration/ConfigurationEditor';

const AuthenticationProviderConfigEditor = types
  .model('AuthenticationProviderPublicConfig', {
    id: types.identifier,
    configEditor: types.optional(ConfigurationEditor, {}),
  })
  .actions(self => ({
    setConfigEditor(configEditor) {
      self.configEditor = configEditor;
    },
  }))
  .views(_self => ({}));

export default AuthenticationProviderConfigEditor;
