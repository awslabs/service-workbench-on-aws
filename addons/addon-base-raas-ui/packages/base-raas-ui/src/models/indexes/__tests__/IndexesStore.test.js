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

import { registerContextItems as registerIndexesStore } from '../IndexesStore';
import { getIndexes, addIndex } from '../../../helpers/api';

jest.mock('../../../helpers/api');

describe('IndexesStore', () => {
  let store = null;
  const appContext = {};
  const newIndex = {
    id: 'gon_freecss',
    rev: 2,
    awsAccountId: 'aws-account-info',
    description: 'whale island',
    createdAt: '1999',
    updatedAt: '2011',
  };

  beforeEach(async () => {
    await registerIndexesStore(appContext);
    store = appContext.indexesStore;
  });

  describe('add index', () => {
    it('should successfully add an index', async () => {
      // BUILD
      getIndexes.mockResolvedValue([]);
      addIndex.mockResolvedValue(newIndex);
      await store.load();

      // OPERATE
      await store.addIndex(newIndex);

      // CHECK
      expect(store.list[0].id).toEqual(newIndex.id);
    });
  });

  describe('get index', () => {
    it('should get and return the specified index', async () => {
      // BUILD
      getIndexes.mockResolvedValue([newIndex]);
      await store.load();

      // OPERATE
      const retVal = await store.getIndex(newIndex.id);

      // CHECK
      expect(retVal).toMatchObject(newIndex);
    });

    it('should return an empty object', async () => {
      // BUILD
      getIndexes.mockResolvedValue([newIndex]);
      await store.load();

      // OPERATE
      const retVal = await store.getIndex('index_that_doesnt_exist');

      // CHECK
      expect(retVal).toMatchObject({});
    });
  });
});
