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

describe('Validate a step templates version configuration scenarios', () => {
  const validConfig = {
    attemptsCount: 1,
    waitPeriod: 1000,
    expiresIn: 10000,
    writeTokenKeyName: 'test',
    lockIdKeyName: 'test',
  };
  const invalidConfig = { ...validConfig, attemptsCount: 'stringInsteadOfInt' };

  let setup;
  let adminSession;
  let templateId;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
    templateId = setup.defaults.stepTemplate.id;
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Validating a step template version configuration', () => {
    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(
        anonymousSession.resources.stepTemplates
          .versions(templateId)
          .version(1)
          .validate(validConfig),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail for inactive user', async () => {
      const researcherSession = await setup.createResearcherSession();
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(
        researcherSession.resources.stepTemplates
          .versions(templateId)
          .version(1)
          .validate(validConfig),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      await expect(
        guestSession.resources.stepTemplates
          .versions(templateId)
          .version(1)
          .validate(validConfig),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      await expect(
        guestSession.resources.stepTemplates
          .versions(templateId)
          .version(1)
          .validate(validConfig),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if researcher', async () => {
      const researcherSession = await setup.createResearcherSession();
      await expect(
        researcherSession.resources.stepTemplates
          .versions(templateId)
          .version(1)
          .validate(validConfig),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should return validation errors if admin but invalid config', async () => {
      await expect(
        adminSession.resources.stepTemplates
          .versions(templateId)
          .version(1)
          .validate(invalidConfig),
      ).resolves.toMatchObject({
        validationErrors: [
          {
            message: 'The attemptsCount must be an integer.',
            type: 'invalid',
          },
        ],
      });
    });

    it('should return no validation errors if admin and valid config', async () => {
      await expect(
        adminSession.resources.stepTemplates
          .versions(templateId)
          .version(1)
          .validate(validConfig),
      ).resolves.toMatchObject({ validationErrors: [] });
    });
  });
});
