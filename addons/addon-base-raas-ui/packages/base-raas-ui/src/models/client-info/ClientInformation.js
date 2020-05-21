import { types } from 'mobx-state-tree';

const ClientInformation = types.model('ClientInformation', {
  ipAddress: '',
});

// eslint-disable-next-line import/prefer-default-export
export { ClientInformation };
