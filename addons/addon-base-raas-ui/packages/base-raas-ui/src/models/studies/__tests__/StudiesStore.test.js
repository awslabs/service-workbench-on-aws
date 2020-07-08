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

import { categories } from '../categories';
import { registerContextItems as registerStudiesStore } from '../StudiesStore';
import { getStudies, createStudy } from '../../../helpers/api';

jest.mock('../../../helpers/api');

describe('StudiesStore', () => {
  let store = null;
  const appContext = {};
  const newStudy = {
    id: 'studying_anew',
    rev: 1,
    name: 'new_beginnings',
  };

  beforeEach(async () => {
    registerStudiesStore(appContext);
    store = appContext.studiesStoresMap[categories.organization.id];
  });

  describe('addStudy', () => {
    it('should add a study', async () => {
      // BUILD
      getStudies.mockResolvedValueOnce([]);

      await store.load();

      // OPERATE
      await store.addStudy(newStudy);

      // CHECk
      expect(store.list[0]).toMatchObject(newStudy);
    });

    it('should not add the study because it already exists', async () => {
      // BUILD
      getStudies.mockResolvedValueOnce([newStudy]);

      await store.load();

      // OPERATE
      await store.addStudy(newStudy);

      // CHECk
      expect(store.list.length).toBe(1);
    });
  });

  describe('getStudyStore', () => {
    it('should create a study store if it does not exist', async () => {
      // BUILD
      getStudies.mockResolvedValueOnce([]);

      await store.load();

      // OPERATE
      const retVal = await store.getStudyStore('newStudyStoreID');

      // CHECK
      expect(retVal.studyId).toBe('newStudyStoreID');
    });
  });

  describe('createStudy', () => {
    it('should create a new study and return it', async () => {
      // BUILD
      getStudies.mockResolvedValueOnce([]);
      createStudy.mockResolvedValueOnce(newStudy);
      await store.load();

      // OPERATE
      const retVal = await store.createStudy(newStudy);

      // CHECK
      expect(retVal).toMatchObject(newStudy);
    });
  });
});
