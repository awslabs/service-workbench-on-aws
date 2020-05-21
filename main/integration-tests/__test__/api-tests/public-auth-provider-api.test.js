const request = require('request-promise-native');

describe('GET /api/authentication/public/provider/configs should,', () => {
  it('return at least one auth provider', async () => {
    const apiBaseUrl = process.env.API_ENDPOINT;
    const response = await request({
      uri: `${apiBaseUrl}/api/authentication/public/provider/configs`,
      json: true,
    });

    expect(response).not.toBeNull();
    expect(response).toEqual(
      expect.arrayContaining([
        {
          id: 'internal',
          title: 'Default Login',
          type: 'internal',
          credentialHandlingType: 'submit',
          signInUri: 'api/authentication/id-tokens',
        },
      ]),
    );
    expect(response.length).toBeGreaterThanOrEqual(1);
  });
});
