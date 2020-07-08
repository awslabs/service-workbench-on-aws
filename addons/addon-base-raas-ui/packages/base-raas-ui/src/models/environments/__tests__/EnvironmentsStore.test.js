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

import { registerContextItems as registerEnvironmentsStore } from '../EnvironmentsStore';
import { getEnvironments, deleteEnvironment, createEnvironment, getEnvironmentCost } from '../../../helpers/api';

jest.mock('../../../helpers/api');

describe('EnvironmentsStore', () => {
  let internalStore = null;
  const internalAppContext = {
    userStore: {
      user: {
        username: 'd.grayson',
        isExternalResearcher: false,
      },
    },
    uiEventBus: {
      fireEvent: jest.fn(),
    },
  };

  const exampleCost = {
    startDate: '01-01-1900',
    cost: {
      exampleCost: {
        amount: 10,
        unit: '$200',
      },
    },
  };

  let newEnv = null;

  beforeEach(async () => {
    registerEnvironmentsStore(internalAppContext);
    internalStore = internalAppContext.environmentsStore;
    newEnv = {
      id: 'gotham_city',
      rev: 1,
      description: 'city of the (in)famous hero',
      name: '',
      status: 'COMPLETED',
      indexId: 'env-id',
      projectId: 'civic_city',
      createdAt: '1941',
      updatedAt: '2019',
      costs: [exampleCost],
      sharedWithUsers: [],
      isExternal: false,
    };
  });

  describe('createEnvironment', () => {
    it('should successfully add the internal environment', async () => {
      // BUILD

      getEnvironments.mockResolvedValueOnce([]);
      createEnvironment.mockResolvedValueOnce(newEnv);
      await internalStore.load();

      // OPERATE
      const retVal = await internalStore.createEnvironment({ pin: '1581963' });

      // CHECK
      expect(retVal).toMatchObject(
        expect.objectContaining({
          id: newEnv.id,
          description: newEnv.description,
          projectId: newEnv.projectId,
        }),
      );

      expect(internalStore.list.length).toEqual(1);
    });
    it('should not create a new internal environment since it already exists', async () => {
      // BUILD
      getEnvironments.mockResolvedValueOnce([newEnv]);
      createEnvironment.mockResolvedValueOnce(newEnv);
      getEnvironmentCost.mockResolvedValueOnce([exampleCost]);
      await internalStore.load();

      // OPERATE
      const retVal = await internalStore.createEnvironment({ pin: '1581963' });

      // CHECK
      expect(retVal).toMatchObject(
        expect.objectContaining({
          id: newEnv.id,
          description: newEnv.description,
          projectId: newEnv.projectId,
        }),
      );
      expect(internalStore.list.length).toBe(1);
    });
  });

  describe('deleteEnvironment', () => {
    it('should try to delete the environment', async () => {
      // BUILD
      getEnvironments.mockResolvedValueOnce([newEnv]);
      getEnvironmentCost.mockResolvedValueOnce([exampleCost]);
      await internalStore.load();

      // OPERATE
      internalStore.deleteEnvironment(newEnv, internalAppContext.userStore.user, '123456');

      // CHECK
      expect(deleteEnvironment).toHaveBeenCalledWith(internalStore.list[0].id);
    });
  });
});
