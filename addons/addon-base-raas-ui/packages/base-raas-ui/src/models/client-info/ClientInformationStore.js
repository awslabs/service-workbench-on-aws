import { types } from 'mobx-state-tree';
import { BaseStore } from '@aws-ee/base-ui/dist/models/BaseStore';

import { getClientIpAddress } from '../../helpers/api';
import { ClientInformation } from './ClientInformation';

// There are situations in which it is useful for the UI to be able to
// determine the IP address that it has, for example so that it can use that
// IP address in a Security Group rule that later restricts access for a given
// compute environment to the user that launched it. So, this store implements
// a "what is my IP address?" feature.
const ClientInformationStore = BaseStore.named('ClientInformationStore')
  .props({
    clientInformation: types.optional(ClientInformation, {}),
  })
  .actions(self => {
    return {
      async doLoad() {
        const info = await getClientIpAddress();
        const ipAddress = info.ipAddress;
        if (ipAddress === '127.0.0.1') {
          // Only for "local" development that we call http://httpbin.org/get
          // otherwise for any other development modes including for production,
          // we call our own api to get the ip address.
          const answer = await fetch('http://httpbin.org/get').then(res => res.json());
          self.runInAction(() => {
            self.clientInformation = ClientInformation.create({ ipAddress: answer && answer.origin });
          });
          return;
        }

        self.runInAction(() => {
          self.clientInformation = ClientInformation.create({ ipAddress });
        });
      },
    };
  })
  .views(self => ({
    get ipAddress() {
      return self.clientInformation.ipAddress;
    },
  }));

function registerContextItems(appContext) {
  appContext.clientInformationStore = ClientInformationStore.create({}, appContext);
}

export { ClientInformationStore, registerContextItems };
