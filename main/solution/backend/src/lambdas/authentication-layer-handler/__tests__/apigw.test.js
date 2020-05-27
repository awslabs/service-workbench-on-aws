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
