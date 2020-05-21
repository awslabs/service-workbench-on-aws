import { types } from 'mobx-state-tree';

const AuthenticationProviderTypeConfig = types.model('AuthenticationProviderTypeConfig', {}).actions(_self => ({
  cleanup() {
    // No-op for now
  },
}));

export default AuthenticationProviderTypeConfig;
