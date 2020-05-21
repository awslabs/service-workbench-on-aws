import { types } from 'mobx-state-tree';
import AuthenticationProviderTypeConfig from './AuthenticationProviderTypeConfig';

const AuthenticationProviderType = types
  .model('AuthenticationProviderType', {
    type: types.string,
    title: types.string,
    description: types.optional(types.string, ''),
    config: AuthenticationProviderTypeConfig,
  })
  .actions(_self => ({
    cleanup() {
      // No-op for now
    },
  }));

export default AuthenticationProviderType;
