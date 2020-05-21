const { parseMethodArn, stringifyMethodArn } = require('../apigw');

describe('parseMethodArn', () => {
  it('parses an API Gateway method arn into constituent parts', () => {
    const arg = 'arn:aws:execute-api:us-east-1:123456789012:api-id/test/GET/mydemoresource/foo';
    const got = parseMethodArn(arg);
    expect(got).toEqual({
      arnPrefix: 'arn:aws:execute-api:us-east-1:123456789012:api-id',
      stageName: 'test',
      httpMethod: 'GET',
      path: '/mydemoresource/foo',
    });
  });

  it('returns undefined if it receives an invalid method arn', () => {
    const got = parseMethodArn('some invalid method arn');
    expect(got).toBeUndefined();
  });
});

describe('stringifyMethodArn', () => {
  it('converts an object of method arn parts into a string', () => {
    const arg = {
      arnPrefix: 'arn:aws:execute-api:us-east-1:123456789012:api-id',
      stageName: 'test',
      httpMethod: 'GET',
      path: '/mydemoresource/foo',
    };
    const got = stringifyMethodArn(arg);
    expect(got).toEqual('arn:aws:execute-api:us-east-1:123456789012:api-id/test/GET/mydemoresource/foo');
  });

  it('replaces missing parts with asterisks', () => {
    const arg = {
      arnPrefix: 'arn:aws:execute-api:us-east-1:123456789012:api-id',
      stageName: 'test',
      path: '/mydemoresource/foo',
    };
    const got = stringifyMethodArn(arg);
    expect(got).toEqual('arn:aws:execute-api:us-east-1:123456789012:api-id/test/*/mydemoresource/foo');
  });
});
