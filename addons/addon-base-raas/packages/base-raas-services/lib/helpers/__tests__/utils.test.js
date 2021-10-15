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
const { addEmptyPrincipalIfNotPresent, addAccountToStatement } = require('../utils');

describe('utils functions', () => {
  const awsArn = 'arn:aws:s3:::bucket-data/users/example@example.com/my-egress-store-1';
  const rootArn = 'arn:aws:iam::01234567891234:root';
  const accountId = '01234567891234';
  describe('addEmptyPrincipalIfNotPresent', () => {
    it('it should return empty s3 policy with empty input', () => {
      expect(addEmptyPrincipalIfNotPresent({})).toStrictEqual({ Principal: { AWS: [] } });
    });
    it('it should return s3 policy with input', () => {
      expect(addEmptyPrincipalIfNotPresent({ Principal: { AWS: [awsArn] } })).toStrictEqual({
        Principal: { AWS: [awsArn] },
      });
    });
  });

  describe('addAccountToStatement', () => {
    it('it should return s3 statement with empty policy input', () => {
      expect(addAccountToStatement({}, accountId)).toStrictEqual({ Principal: { AWS: [rootArn] } });
    });
  });
});
