import { types } from 'mobx-state-tree';
import _ from 'lodash';

const ApiKey = types
  .model('ApiKey', {
    id: types.identifier,
    ns: '',
    username: '',
    updatedAt: '',
    status: '',
    createdAt: '',
    expiryTime: 0,
    key: types.optional(types.string, ''),
  })
  .views(self => ({
    get effectiveStatus() {
      if (self.status !== 'active') {
        // if status it not active then the effective status is same as status (such as "revoked")
        return self.status;
      }
      // if status is active then make sure it is not expired
      if (self.expiryTime > 0 && _.now() > self.expiryTime) {
        return 'expired';
      }
      return self.status;
    },
  }));

export default ApiKey;
