import { getCosts, getLabels } from '../Dashboard';

describe('Dashboard tests', () => {
  describe('Labels', () => {
    it('Test labels with duplicates', async () => {
      const duplicateEnvNames = new Set();
      duplicateEnvNames.add('name2_2');
      const envIdToCostInfo = {
        id1: { pastMonthCostByUser: { 'user1@gmail.com': 5.64 }, yesterdayCost: 0 },
        id2: { pastMonthCostByUser: { 'user2@gmail.com': 2 }, yesterdayCost: 0 },
        id3: { pastMonthCostByUser: { 'user1@gmail.com': 3 }, yesterdayCost: 0 },
        id4: { pastMonthCostByUser: { 'user1@gmail.com': 4 }, yesterdayCost: 4 },
        id5: { pastMonthCostByUser: {}, yesterdayCost: 0 },
      };
      const envIdToEnvMetadata = {
        id1: { index: 'index1', name: 'name1_1' },
        id2: { index: 'index1', name: 'name2_1' },
        id3: { index: 'index2', name: 'name1_2' },
        id4: { index: 'index2', name: 'name2_2' },
        id5: { index: 'index2', name: 'name2_2' },
      };
      const labels = getLabels(envIdToCostInfo, envIdToEnvMetadata, duplicateEnvNames);
      expect(labels).toEqual(['name1_1', 'name2_1', 'name1_2', 'name2_2: id4', 'name2_2: id5']);
    });

    it('Test labels without duplicates', async () => {
      const duplicateEnvNames = new Set();
      const envIdToCostInfo = {
        id1: { pastMonthCostByUser: { 'user1@gmail.com': 5.64 }, yesterdayCost: 0 },
        id2: { pastMonthCostByUser: { 'user2@gmail.com': 2 }, yesterdayCost: 0 },
        id3: { pastMonthCostByUser: { 'user1@gmail.com': 3 }, yesterdayCost: 0 },
        id4: { pastMonthCostByUser: { 'user1@gmail.com': 4 }, yesterdayCost: 4 },
        id5: { pastMonthCostByUser: {}, yesterdayCost: 0 },
      };
      const envIdToEnvMetadata = {
        id1: { index: 'index1', name: 'name1_1' },
        id2: { index: 'index1', name: 'name2_1' },
        id3: { index: 'index2', name: 'name1_2' },
        id4: { index: 'index2', name: 'name2_2' },
        id5: { index: 'index2', name: 'name3_2' },
      };
      const labels = getLabels(envIdToCostInfo, envIdToEnvMetadata, duplicateEnvNames);
      expect(labels).toEqual(['name1_1', 'name2_1', 'name1_2', 'name2_2', 'name3_2']);
    });
  });

  describe('Cost aggregation', () => {
    it('Test with no cost data', async () => {
      function getEnvironments() {
        return [
          {
            name: 'name1_1',
            indexId: 'index1',
            id: 'id1',
          },
          {
            name: 'name2_1',
            indexId: 'index1',
            id: 'id2',
          },
        ];
      }
      const getEnvironmentCost = jest.fn();
      getEnvironmentCost.mockImplementation((envId, days, groupByService, groupByUser) => {
        expect(days).toEqual(30);
        expect(groupByService).toEqual(false);
        expect(groupByUser).toEqual(true);
        switch (envId) {
          case 'id1':
            return [
              {
                startDate: '2021-03-31',
                cost: {},
              },
              {
                startDate: '2021-04-01',
                cost: {},
              },
              {
                startDate: '2021-04-02',
                cost: {},
              },
              {
                startDate: '2021-04-03',
                cost: {},
              },
            ];

          case 'id2':
            return [
              {
                startDate: '2021-04-01',
                cost: {},
              },
              {
                startDate: '2021-04-02',
                cost: {},
              },
              {
                startDate: '2021-04-03',
                cost: {},
              },
            ];

          default:
            throw Error('Invalid environmentId');
        }
      });
      const aggregatedCosts = await getCosts(getEnvironments, getEnvironmentCost);
      const duplicateEnvNames = new Set();
      expect(aggregatedCosts.duplicateEnvNames).toEqual(duplicateEnvNames);
      expect(aggregatedCosts.totalCost).toEqual(0);
      expect(aggregatedCosts.indexNameToTotalCost).toEqual({
        index1: 0,
      });
      expect(aggregatedCosts.envIdToEnvMetadata).toEqual({
        id1: { index: 'index1', name: 'name1_1' },
        id2: { index: 'index1', name: 'name2_1' },
      });
      expect(aggregatedCosts.indexNameToUserTotalCost).toEqual({
        index1: {},
      });
      expect(aggregatedCosts.envIdToCostInfo).toEqual({
        id1: { pastMonthCostByUser: {}, yesterdayCost: 0 },
        id2: { pastMonthCostByUser: {}, yesterdayCost: 0 },
      });
    });

    it('Test with multiple indexes, users and environments', async () => {
      function getEnvironments() {
        return [
          {
            name: 'name1_1',
            indexId: 'index1',
            id: 'id1',
          },
          {
            name: 'name2_1',
            indexId: 'index1',
            id: 'id2',
          },
          {
            name: 'name1_2',
            indexId: 'index2',
            id: 'id3',
          },
          {
            name: 'name2_2',
            indexId: 'index2',
            id: 'id4',
          },
          {
            name: 'name2_2',
            indexId: 'index2',
            id: 'id5',
          },
        ];
      }
      const getEnvironmentCost = jest.fn();
      getEnvironmentCost.mockImplementation((envId, days, groupByService, groupByUser) => {
        expect(days).toEqual(30);
        expect(groupByService).toEqual(false);
        expect(groupByUser).toEqual(true);
        switch (envId) {
          case 'id1':
            return [
              {
                startDate: '2021-03-31',
                cost: {
                  'CreatedBy$user1@gmail.com': {
                    amount: 1.0,
                    unit: 'USD',
                  },
                },
              },
              {
                startDate: '2021-04-01',
                cost: {
                  'CreatedBy$user1@gmail.com': {
                    amount: 4.0,
                    unit: 'USD',
                  },
                },
              },
              {
                startDate: '2021-04-02',
                cost: {
                  'CreatedBy$user1@gmail.com': {
                    amount: 0.64,
                    unit: 'USD',
                  },
                },
              },
              {
                startDate: '2021-04-03',
                cost: {},
              },
            ];

          case 'id2':
            return [
              {
                startDate: '2021-04-01',
                cost: {
                  'CreatedBy$user2@gmail.com': {
                    amount: 2.0,
                    unit: 'USD',
                  },
                },
              },
              {
                startDate: '2021-04-02',
                cost: {},
              },
              {
                startDate: '2021-04-03',
                cost: {},
              },
            ];

          case 'id3':
            return [
              {
                startDate: '2021-04-01',
                cost: {},
              },
              {
                startDate: '2021-04-02',
                cost: {
                  'CreatedBy$user1@gmail.com': {
                    amount: 3.0,
                    unit: 'USD',
                  },
                },
              },
              {
                startDate: '2021-04-03',
                cost: {},
              },
            ];

          case 'id4':
            return [
              {
                startDate: '2021-04-01',
                cost: {},
              },
              {
                startDate: '2021-04-02',
                cost: {},
              },
              {
                startDate: '2021-04-03',
                cost: {
                  'CreatedBy$user1@gmail.com': {
                    amount: 4.0,
                    unit: 'USD',
                  },
                },
              },
            ];

          case 'id5':
            return [
              {
                startDate: '2021-04-01',
                cost: {},
              },
              {
                startDate: '2021-04-02',
                cost: {},
              },
              {
                startDate: '2021-04-03',
                cost: {},
              },
            ];

          default:
            throw Error('Invalid environmentId');
        }
      });
      const aggregatedCosts = await getCosts(getEnvironments, getEnvironmentCost);
      const duplicateEnvNames = new Set();
      duplicateEnvNames.add('name2_2');
      expect(aggregatedCosts.duplicateEnvNames).toEqual(duplicateEnvNames);
      expect(aggregatedCosts.totalCost).toEqual(14.64);
      expect(aggregatedCosts.indexNameToTotalCost).toEqual({
        index1: 7.64,
        index2: 7,
      });
      expect(aggregatedCosts.envIdToEnvMetadata).toEqual({
        id1: { index: 'index1', name: 'name1_1' },
        id2: { index: 'index1', name: 'name2_1' },
        id3: { index: 'index2', name: 'name1_2' },
        id4: { index: 'index2', name: 'name2_2' },
        id5: { index: 'index2', name: 'name2_2' },
      });
      expect(aggregatedCosts.indexNameToUserTotalCost).toEqual({
        index1: { 'user1@gmail.com': 5.64, 'user2@gmail.com': 2 },
        index2: { 'user1@gmail.com': 7 },
      });
      expect(aggregatedCosts.envIdToCostInfo).toEqual({
        id1: { pastMonthCostByUser: { 'user1@gmail.com': 5.64 }, yesterdayCost: 0 },
        id2: { pastMonthCostByUser: { 'user2@gmail.com': 2 }, yesterdayCost: 0 },
        id3: { pastMonthCostByUser: { 'user1@gmail.com': 3 }, yesterdayCost: 0 },
        id4: { pastMonthCostByUser: { 'user1@gmail.com': 4 }, yesterdayCost: 4 },
        id5: { pastMonthCostByUser: {}, yesterdayCost: 0 },
      });
    });
  });
});
