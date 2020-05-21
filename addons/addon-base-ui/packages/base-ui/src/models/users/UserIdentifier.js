import { getSnapshot, types } from 'mobx-state-tree';

// A user may be authenticated by different authentication providers due to this there is a
// chance of collision of usernames across different authentication/identity providers.
// Due to this, each user is uniquely identified by not just the username but "username" plus "ns" (i.e., namespace).
// The MST model below represents this user identifier containing username and the namespace.
const UserIdentifier = types
  .model('UserIdentifier', {
    username: '',
    ns: '',
  })
  .views(self => ({
    isSame({ username, ns }) {
      return self.username === username && self.ns === ns;
    },
    get id() {
      return self.identifierStr;
    },
    get identifier() {
      return self;
    },
    get identifierStr() {
      return JSON.stringify(getSnapshot(self));
    },
  }));

export default UserIdentifier;
