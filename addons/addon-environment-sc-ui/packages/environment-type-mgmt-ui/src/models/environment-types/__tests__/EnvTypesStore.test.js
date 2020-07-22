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

import { getAllEnvTypes, createEnvType } from '../../../helpers/api';

import { registerContextItems as registerEnvTypesStore } from '../EnvTypesStore';

jest.mock('../../../helpers/api');

describe('EnvTypesStore', () => {
  let store = null;
  const appContext = {
    envTypeCandidatesStore: {
      onEnvTypeCandidateImport: jest.fn(),
      load: jest.fn(),
    },
  };

  beforeEach(async () => {
    await registerEnvTypesStore(appContext);
    store = appContext.envTypesStore;
  });

  it('should add a new envType', async () => {
    // BUILD
    const newEnvType = {
      id: 'watson',
      status: 'approved',
    };
    await store.load();

    // OPERATE
    await store.addEnvType(newEnvType);

    // CHECK
    const ret = store.getEnvType(newEnvType.id);
    expect(ret).toBeDefined();
    expect(ret.id).toBe(newEnvType.id);
  });

  it('should create a new envType', async () => {
    // BUILD
    const newEnvType = {
      id: 'crick?',
      status: 'approved',
    };
    createEnvType.mockResolvedValueOnce(newEnvType);
    await store.load();

    // OPERATE
    await store.createEnvType(newEnvType);

    // CHECK
    expect(store.list[0].id).toBe(newEnvType.id);
    expect(appContext.envTypeCandidatesStore.onEnvTypeCandidateImport).toHaveBeenCalledWith(newEnvType.id);
  });

  it('should remove the existing environment', async () => {
    // BUILD
    const existingEnvType = {
      id: 'or_jennings?',
      status: 'approved',
    };

    getAllEnvTypes.mockResolvedValueOnce([existingEnvType]);
    await store.load();
    expect(store.list[0]).toBeDefined();

    // OPERATE
    await store.deleteEnvType(existingEnvType.id);

    // CHECK
    expect(store.list[0]).toBeUndefined();
    expect(store.list.length).toBe(0);
    expect(appContext.envTypeCandidatesStore.load).toHaveBeenCalled();
  });
});
