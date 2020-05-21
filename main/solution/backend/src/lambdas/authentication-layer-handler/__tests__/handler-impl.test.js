const newHandler = require('../handler-impl');

describe('handler', () => {
  let handler;
  let authenticationService;

  beforeEach(async () => {
    authenticationService = {
      authenticate: jest.fn(() => Promise.resolve({})),
    };
    handler = newHandler({
      authenticationService,
    });
  });

  it('throws an internal error if the method arn is not a valid API gateway method arn', async () => {
    return expect(
      handler({
        methodArn: 'some-invalid-method-arn',
      }),
    ).rejects.toThrow();
  });

  it('removes the bearer prefix from authorizationTokens containing a Bearer prefix', async () => {
    authenticationService.authenticate = jest.fn(() => Promise.resolve({ authenticated: true }));
    await handler({
      methodArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/test/GET/mydemoresource/foo',
      authorizationToken: 'Bearer foo',
    });
    expect(authenticationService.authenticate).toHaveBeenCalledWith('foo');
  });

  it('throws an unauthorized error if a token is not authenticated', async () => {
    authenticationService.authenticate = jest.fn(() => Promise.resolve({ authenticated: false }));
    return expect(
      handler({
        methodArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/test/GET/mydemoresource/foo',
        authorizationToken: 'foo',
      }),
    ).rejects.toThrow('Unauthorized');
  });

  it('returns an allow policy with context variables if the token is authenticated', async () => {
    authenticationService.authenticate = jest.fn(() =>
      Promise.resolve({
        authenticated: true,
        username: 'me',
        authenticationProviderId: 'my.provider.id',
        identityProviderId: 'my.idp.com',
      }),
    );
    const result = await handler({
      methodArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/test/GET/mydemoresource/foo',
      authorizationToken: 'foo',
    });
    expect(result).toEqual({
      principalId: 'me',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'execute-api:Invoke',
            Resource: 'arn:aws:execute-api:us-east-1:123456789012:api-id/test/*/*',
          },
        ],
      },
      context: {
        authenticationProviderId: 'my.provider.id',
        identityProviderId: 'my.idp.com',
        username: 'me',
      },
    });
  });

  it('removes invalid entries from the returned context object', async () => {
    authenticationService.authenticate = jest.fn(() =>
      Promise.resolve({
        authenticated: true,
        username: 'me',
        authenticationProviderId: 'my.provider.id',
        identityProviderId: 'my.idp.com',
        some: { invalid: { context: 'object' } },
      }),
    );
    const result = await handler({
      methodArn: 'arn:aws:execute-api:us-east-1:123456789012:api-id/test/GET/mydemoresource/foo',
      authorizationToken: 'foo',
    });
    expect(result).toEqual({
      principalId: 'me',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: 'execute-api:Invoke',
            Resource: 'arn:aws:execute-api:us-east-1:123456789012:api-id/test/*/*',
          },
        ],
      },
      context: {
        authenticationProviderId: 'my.provider.id',
        identityProviderId: 'my.idp.com',
        username: 'me',
      },
    });
  });
});
