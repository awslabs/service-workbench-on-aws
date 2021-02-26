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
const errorCode = require('../../../support/utils/error-code');

describe('Get authentication config list scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Get authentication config list', () => {
    it('should fail if user is not an admin', async () => {
      const researcherSession = await setup.createResearcherSession();

      await expect(researcherSession.resources.authentication.configs().get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if user is inactive', async () => {
      const admin2Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin2Session.user);

      await expect(admin2Session.resources.authentication.configs().get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should list auth provider configs', async () => {
      const admin2Session = await setup.createAdminSession();
      const response = await admin2Session.resources.authentication.configs().get();

      await expect(response).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            config: {
              id: 'internal',
              signInUri: 'api/authentication/id-tokens',
              title: 'Default Login',
              type: {
                config: {
                  credentialHandlingType: 'submit',
                  impl: {
                    provisionerLocator: 'locator:service:internalAuthenticationProvisionerService/provision',
                    tokenIssuerLocator: 'locator:service:internalAuthenticationProviderService/issueToken',
                    tokenRevokerLocator: 'locator:service:internalAuthenticationProviderService/revokeToken',
                    tokenValidatorLocator: 'locator:service:internalAuthenticationProviderService/validateToken',
                  },
                  inputManifestForCreate: {
                    sections: [
                      {
                        children: [
                          {
                            desc:
                              'This is a required field. This is used for uniquely identifying the authentication provider. It must be between 2 to 64 characters long and must start with an alphabet and may contain alpha numeric characters, underscores, and dashes. No other special symbols are allowed.',
                            name: 'id',
                            rules: 'required|string|between:2,64|regex:/^[a-zA-Z][a-zA-Z0-9_-]+$/',
                            title: 'ID',
                            type: 'stringInput',
                          },
                          {
                            desc: 'This is a required field and must be between 3 and 255 characters long.',
                            name: 'title',
                            rules: 'required|between:3,255',
                            title: 'Title',
                            type: 'stringInput',
                          },
                          {
                            desc: 'The Sign In URI that accepts username/password for signing in.',
                            name: 'signInUri',
                            rules: 'required|between:3,255',
                            title: 'Sign In URI',
                            type: 'stringInput',
                          },
                          {
                            desc: 'The Sign Out URI to log out user.',
                            name: 'signOutUri',
                            rules: 'required|between:3,255',
                            title: 'Sign Out URI',
                            type: 'stringInput',
                          },
                        ],
                        title: 'General Information',
                      },
                    ],
                  },
                  inputManifestForUpdate: {
                    sections: [
                      {
                        children: [
                          {
                            desc:
                              'This is a required field. This is used for uniquely identifying the authentication provider. It must be between 2 to 64 characters long and must start with an alphabet and may contain alpha numeric characters, underscores, and dashes. No other special symbols are allowed.',
                            name: 'id',
                            rules: 'required|string|between:2,64|regex:/^[a-zA-Z][a-zA-Z0-9_-]+$/',
                            title: 'ID',
                            type: 'stringInput',
                          },
                          {
                            desc: 'This is a required field and must be between 3 and 255 characters long.',
                            name: 'title',
                            rules: 'required|between:3,255',
                            title: 'Title',
                            type: 'stringInput',
                          },
                        ],
                        title: 'General Information',
                      },
                    ],
                  },
                  inputSchema: {
                    $id: 'http://example.com/root.json',
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    definitions: {},
                    properties: {
                      id: { $id: '#/properties/id', type: 'string' },
                      signInUri: { $id: '#/properties/signInUri', type: 'string' },
                      signOutUri: { $id: '#/properties/signOutUri', type: 'string' },
                      title: { $id: '#/properties/title', type: 'string' },
                    },
                    required: ['id', 'title', 'signInUri'],
                    type: 'object',
                  },
                },
                description:
                  'This is a built-in internal authentication provider. The internal authentication provider uses an internal user directory for authenticating the users. This provider is only intended to be used for development and testing. It currently lacks many features required for production usage such as ability to force password rotations, ability to reset passwords, and support "forgot password" etc. For production use, please add other authentication provider with identity federation for production use.',
                title: 'Internal',
                type: 'internal',
              },
            },
            id: 'internal',
            status: 'active',
          }),
        ]),
      );
    });

    it('should fail if internal guest attempts to get auth configs list', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      await expect(guestSession.resources.authentication.configs().get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if external guest attempts to get auth configs list', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });

      await expect(guestSession.resources.authentication.configs().get()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.authentication.configs().get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
