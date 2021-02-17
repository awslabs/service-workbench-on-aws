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

const { runSetup } = require('../../../support/setup');

describe('Get public auth provider config scenarios', () => {
  let setup;
  let anonymousSession;

  beforeAll(async () => {
    setup = await runSetup();
    anonymousSession = await setup.createAnonymousSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  it('return at least one auth provider', async () => {
    await expect(anonymousSession.resources.publicAuthProviderConfigs.get()).resolves.toEqual(
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
  });
});
