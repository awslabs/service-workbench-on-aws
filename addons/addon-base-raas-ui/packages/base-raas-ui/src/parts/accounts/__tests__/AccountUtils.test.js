const { getAccountIdsOfActiveEnvironments } = require('../AccountUtils');

describe('AccountUtils', () => {
  describe('getAccountIdsOfActiveEnvironments', () => {
    const projects = [
      {
        id: 'proj-1',
        rev: 0,
        description: 'proj-1',
        indexId: 'index-1',
      },
      {
        id: 'proj-2',
        rev: 0,
        description: 'proj-2',
        indexId: 'index-2',
      },
      {
        id: 'proj-3',
        rev: 0,
        description: 'proj-3',
        indexId: 'index-3',
      },
    ];
    const indexes = [
      {
        id: 'index-1',
        rev: 0,
        awsAccountId: 'aws-account-id-1',
        description: 'index-1',
      },
      {
        id: 'index-2',
        rev: 0,
        awsAccountId: 'aws-account-id-2',
        description: 'index-2',
      },
      {
        id: 'index-3',
        rev: 0,
        awsAccountId: 'aws-account-id-3',
        description: 'index-3',
      },
    ];
    it('three environments running in two accounts', () => {
      const scEnvs = [
        {
          id: 'e3eef317-e46b-43fd-9d8c-cedf3e9bb090',
          rev: 1,
          status: 'COMPLETED',
          description: 'abc',
          name: 'sagemaker-1',
          projectId: 'proj-1',
          envTypeId: 'prod-ty2w5glxhevq2-pa-y4x5otqfxeefw',
        },
        {
          id: '113c83f6-6da5-4acb-84f7-7eb0f2b936c9',
          rev: 1,
          status: 'COMPLETED',
          description: 'abc',
          name: 'linux-1',
          projectId: 'proj-1',
          envTypeId: 'prod-jkyan5uj4ccho-pa-57f5kw6tihbaq',
        },
        {
          id: 'ba4bb0c0-432f-4b4f-bfad-88498d99916c',
          rev: 1,
          status: 'COMPLETED',
          description: 'abc',
          name: 'linux-2',
          projectId: 'proj-2',
          envTypeId: 'prod-jkyan5uj4ccho-pa-57f5kw6tihbaq',
        },
      ];
      const accountIds = getAccountIdsOfActiveEnvironments(scEnvs, projects, indexes);

      // Two accounts with running environments
      expect(accountIds).toEqual(['aws-account-id-1', 'aws-account-id-2']);
    });
    it('one terminated environment', () => {
      const scEnvs = [
        {
          id: 'e3eef317-e46b-43fd-9d8c-cedf3e9bb090',
          rev: 1,
          status: 'TERMINATED',
          description: 'abc',
          name: 'sagemaker-1',
          projectId: 'proj-1',
          envTypeId: 'prod-ty2w5glxhevq2-pa-y4x5otqfxeefw',
        },
      ];
      const accountIds = getAccountIdsOfActiveEnvironments(scEnvs, projects, indexes);

      // No accounts with running environments
      expect(accountIds).toEqual([]);
    });
    it('one terminated environment and one active environment', () => {
      const scEnvs = [
        {
          id: 'e3eef317-e46b-43fd-9d8c-cedf3e9bb090',
          rev: 1,
          status: 'TERMINATED',
          description: 'abc',
          name: 'sagemaker-1',
          projectId: 'proj-1',
          envTypeId: 'prod-ty2w5glxhevq2-pa-y4x5otqfxeefw',
        },
        {
          id: '113c83f6-6da5-4acb-84f7-7eb0f2b936c9',
          rev: 1,
          status: 'COMPLETED',
          description: 'abc',
          name: 'linux-1',
          projectId: 'proj-1',
          envTypeId: 'prod-jkyan5uj4ccho-pa-57f5kw6tihbaq',
        },
      ];
      const accountIds = getAccountIdsOfActiveEnvironments(scEnvs, projects, indexes);

      // One account with active environment
      expect(accountIds).toEqual(['aws-account-id-1']);
    });
  });
});
