import { getStaleUsers } from '../StudyPermissionsTable';

describe('StudyPermissionsTable tests', () => {
  describe('getStaleUsers', () => {
    it('Test stale users when no users are stale', async () => {
      const usersStore = {};
      usersStore.asUserObjects = jest.fn().mockImplementationOnce(() => {
        return [{ id: 1 }, { id: 2 }];
      });
      const staleUsers = getStaleUsers([1, 2], usersStore);
      expect(staleUsers).toEqual([]);
      expect(usersStore.asUserObjects).toHaveBeenCalledTimes(1);
    });

    it('Test stale users when all users are stale', async () => {
      const usersStore = {};
      usersStore.asUserObjects = jest.fn().mockImplementationOnce(() => {
        return [];
      });
      const staleUsers = getStaleUsers([1, 2], usersStore);
      expect(staleUsers).toEqual([1, 2]);
      expect(usersStore.asUserObjects).toHaveBeenCalledTimes(1);
    });

    it('Test stale users when one user is stale', async () => {
      const usersStore = {};
      usersStore.asUserObjects = jest.fn().mockImplementationOnce(() => {
        return [{ id: 1 }, { id: 4 }, { id: 3 }];
      });
      const staleUsers = getStaleUsers([1, 2, 4, 3], usersStore);
      expect(staleUsers).toEqual([2]);
      expect(usersStore.asUserObjects).toHaveBeenCalledTimes(1);
    });
  });
});
