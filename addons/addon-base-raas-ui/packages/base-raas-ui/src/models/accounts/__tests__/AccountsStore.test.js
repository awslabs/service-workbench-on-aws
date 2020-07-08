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

import { getAccounts, removeAccountInfo } from '../../../helpers/api';
import { registerContextItems as registerAccountsStore } from '../AccountsStore';

jest.mock('../../../helpers/api');

describe('AccountsStore', () => {
  let store = null;
  const appContext = {};
  const newAccount = {
    id: 'mscott',
    accountName: 'It all starts with an idea.',
    accountArn: 'But you can never tell where an idea will end up.',
    email: 'because-ideas-spread-they-change-they-grow@example.com',
    name: 'They connect us with the world.',
    createdAt: 'Limitless paper',
    updatedAt: 'in a paperless world',
    rev: 100,
    status: 'COMPLETED',
  };

  beforeEach(async () => {
    await registerAccountsStore(appContext);
    store = appContext.accountsStore;
  });

  describe('addAccount', () => {
    it('should add a account', async () => {
      // BUILD
      getAccounts.mockResolvedValueOnce([]);
      await store.load();

      // OPERATE
      await store.addAccount(newAccount);

      // CHECK
      expect(store.list[0]).toMatchObject(newAccount);
    });

    it('should not add the project because it already exists', async () => {
      // BUILD
      getAccounts.mockResolvedValueOnce([newAccount]);
      await store.load();

      // OPERATE
      await store.addAccount(newAccount);

      // CHECK
      expect(store.list.length).toBe(1);
    });
  });

  describe('removeItem', () => {
    it('should remove the account', async () => {
      // BUILD
      getAccounts.mockResolvedValueOnce([newAccount]);
      await store.load();

      // OPERATE
      await store.removeItem(newAccount.id);
      // I'm not sure why the function is 'removeItem' and not 'deleteAccount'
      // breaks the convention set by some of the others

      // CHECK
      expect(removeAccountInfo).toHaveBeenCalledWith(newAccount.id);
    });
  });
});
