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
