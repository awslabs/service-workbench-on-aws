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

// AWS ARN consists of 'arn', partition, service, region, accountID, resource (separated by ':').
// API Gateway method arn consists of AWS ARN as above, but resource futher split into stage, method, and path (separated by '/').
const methodArnRegexp = /^(arn:[\w-]+:[\w-]+:[\w-]+:[\w-]+:[\w-]+)\/([^/]+)\/([^/]+)(.+)$/;

const parseMethodArn = s => {
  const matched = methodArnRegexp.exec(s);
  if (!matched) {
    return undefined;
  }
  const [_orig, arnPrefix, stageName, httpMethod, path] = matched;
  return {
    arnPrefix,
    stageName,
    httpMethod,
    path,
  };
};

const stringifyMethodArn = ({ arnPrefix, stageName = '*', httpMethod = '*', path = '/*' }) =>
  `${arnPrefix}/${stageName}/${httpMethod}${path}`;

const buildRestApiPolicy = ({ arnPrefix, stageName }, Effect = 'Deny') => ({
  Version: '2012-10-17',
  Statement: [
    {
      Effect,
      Action: 'execute-api:Invoke',
      Resource: stringifyMethodArn({
        arnPrefix,
        stageName,
        httpMethod: '*',
        path: '/*',
      }),
    },
  ],
});

const newUnauthorizedError = () => new Error('Unauthorized');

const customAuthorizerResponse = ({ principalId, policyDocument, context = {} }) => ({
  principalId,
  policyDocument,
  context,
});

module.exports = {
  stringifyMethodArn,
  parseMethodArn,
  buildRestApiPolicy,
  newUnauthorizedError,
  customAuthorizerResponse,
};
