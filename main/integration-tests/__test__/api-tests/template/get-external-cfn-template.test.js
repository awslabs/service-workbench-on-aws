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

describe('Get external CFN template scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Getting an external CFN template', () => {
    it('should fail if user is inactive', async () => {
      const researcherSession = await setup.createResearcherSession();
      await adminSession.resources.users.deactivateUser(researcherSession.user);

      await expect(researcherSession.resources.templates.template('sampleId').get()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail is key not found', async () => {
      const researcherSession = await setup.createResearcherSession();

      await expect(
        researcherSession.resources.templates.template('sampleFolder1/sampleFolder2').get(),
      ).rejects.toMatchObject({ code: errorCode.http.code.badImplementation });
    });

    it('should pass for dummy file with dummy URL for internal guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });

      const dummyFile = setup.gen.string({ prefix: 'ext-cfn-test' });

      // This generates a presigned URL for a resource that does not exist in S3
      // and therefore results in an error if someone were to follow the link
      await expect(guestSession.resources.templates.template(dummyFile).get()).resolves.not.toBeUndefined();
    });

    it('should pass for dummy file with dummy URL for external guest', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });

      const dummyFile = setup.gen.string({ prefix: 'ext-cfn-test' });

      // This generates a presigned URL for a resource that does not exist in S3
      // and therefore results in an error if someone were to follow the link
      await expect(guestSession.resources.templates.template(dummyFile).get()).resolves.not.toBeUndefined();
    });

    it('should pass for dummy file with dummy URL', async () => {
      const researcherSession = await setup.createResearcherSession();
      const dummyFile = setup.gen.string({ prefix: 'ext-cfn-test' });

      // This generates a presigned URL for a resource that does not exist in S3
      // and therefore results in an error if someone were to follow the link
      await expect(researcherSession.resources.templates.template(dummyFile).get()).resolves.not.toBeUndefined();
    });

    it('should fail for anonymous user', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.templates.template('sampleId').get()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
