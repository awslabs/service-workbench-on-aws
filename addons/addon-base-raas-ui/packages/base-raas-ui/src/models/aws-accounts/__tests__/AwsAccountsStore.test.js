/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License").
 *  You may not use this file except in compliance with the License.
 *  A copy of the License is located at
 *
 *  http://aws.amazon.com/apache2.0
 *
 *  or in the "license" file accompanying this file. This file is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *  express or implied. See the License for the specific language governing
 *  permissions and limitations under the License.
 */

import { getAwsAccounts, addAwsAccount } from '../../../helpers/api';
import { registerContextItems as registerAwsAccountsStore } from '../AwsAccountsStore';

jest.mock('../../../helpers/api');

describe('AwsAccountsStore', () => {
  let store = null;
  const appContext = {};
  const newAwsAccount = {
    id: 'mouserat',
    rev: 5000,
    name: 'candles-in-the-wind',
    description: 'up in horsey heaven, heres the thing',
    accountId: 'you_trade_your_legs_for_angels_wings',
    externalId: 'and-once-weve-all-said-goodbye',
    roleArn: 'YouTakeARunningLeapAndYouLearnToFly',
    vpcId: 'and_although_we_all_miss_you_every_day',
    subnetId: 'we-know-youre-up-there-eating-heavens-hay',
    encryptionKeyArn: 'AndHeresThePartThatHurtsTheMost',
    createdAt: 'humans cannot ride a ghost :(',
    updatedAt: 'Bye bye, Lil Sebastian',
    needsPermissionUpdate: false,
  };

  beforeEach(async () => {
    await registerAwsAccountsStore(appContext);
    store = appContext.awsAccountsStore;
  });

  describe('addAwsAccount', () => {
    it('should add a new Aws Account successfully', async () => {
      // BUILD
      getAwsAccounts.mockResolvedValue([]);
      addAwsAccount.mockResolvedValue(newAwsAccount);
      await store.load();

      // OPERATE
      await store.addAwsAccount(newAwsAccount);

      // CHECK
      expect(newAwsAccount).toMatchObject(store.list[0]);
      // some properties are dropped when added, so this makes sure store.list[0]
      //      is a subset of newAwsAccount
    });

    it('should not add an Aws Account', async () => {
      // BUILD
      getAwsAccounts.mockResolvedValue([newAwsAccount]);
      addAwsAccount.mockResolvedValue(newAwsAccount);
      await store.load();

      // OPERATE
      await store.addAwsAccount(newAwsAccount);

      // CHECK
      expect(store.list.length).toBe(1);
    });
  });

  describe('filteredList', () => {
    it('should return the whole list if the filter does not exist', async () => {
      // BUILD
      getAwsAccounts.mockResolvedValue([newAwsAccount]);
      await store.load();

      // OPERATE
      const retVal = store.filtered('randomfiltername');

      // CHECK
      expect(retVal).toMatchObject(store.list);
    });
  });
});
