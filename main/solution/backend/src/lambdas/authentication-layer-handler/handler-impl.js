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

const { parseMethodArn, buildRestApiPolicy, newUnauthorizedError, customAuthorizerResponse } = require('./apigw');

const bearerPrefix = 'Bearer ';

const getToken = authorizationHeader => {
  if (!authorizationHeader) {
    return '';
  }
  if (authorizationHeader.startsWith(bearerPrefix)) {
    return authorizationHeader.slice(bearerPrefix.length);
  }
  return authorizationHeader;
};

const sanitizeResponseContext = context => {
  return Object.entries(context)
    .filter(([_, value]) => typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
};

const noopAuthenticationService = {
  async authenticate() {
    return { authenticated: false };
  },
};

const consoleLogger = {
  info(...args) {
    // eslint-disable-next-line no-console
    console.log(...args);
  },
};

module.exports = function newHandler({ authenticationService = noopAuthenticationService, log = consoleLogger } = {}) {
  return async ({ methodArn: rawMethodArn, authorizationToken }) => {
    const methodArn = parseMethodArn(rawMethodArn);
    if (!methodArn) {
      throw new Error(`invalid method arn: ${rawMethodArn}`);
    }
    const token = getToken(authorizationToken);
    const result = await authenticationService.authenticate(token);
    const { authenticated, error, ...claims } = result;
    if (error) {
      log.info(
        `authentication error for ${claims.username || '<anonymous>'}/${claims.authenticationProviderId ||
          '<unknown provider>'}: ${error.toString()}`,
      );
    }
    if (!authenticated) {
      throw newUnauthorizedError();
    }
    return customAuthorizerResponse({
      principalId: claims.uid,
      policyDocument: buildRestApiPolicy(methodArn, 'Allow'),
      context: sanitizeResponseContext(claims),
    });
  };
};
