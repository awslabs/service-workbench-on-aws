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

describe('Create study scenarios', () => {
  let setup;
  let adminSession;
  let accountId;
  let bucketName;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();

    // We register an account to be used by all the tests in this test suite
    accountId = setup.gen.accountId();
    await adminSession.resources.dataSources.accounts.create({ id: accountId });

    // We register a bucket to be used by all the BYOB-related tests in this test suite
    bucketName = setup.gen.string({ prefix: 'ds-study-test' });
    await adminSession.resources.dataSources.accounts
      .account(accountId)
      .buckets()
      .create({ name: bucketName });
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  const studyCategoryCases = [
    ['my-study', 'My Studies'],
    ['org-study', 'Organization'],
  ];
  describe('Creating study', () => {
    it('should fail if non-system user tries to create Open Data studies', async () => {
      const researcherSession = await setup.createResearcherSession();
      const studyId = setup.gen.string({ prefix: 'create-study-test-non-system' });

      await expect(
        researcherSession.resources.studies.create({ id: studyId, category: 'Open Data' }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it.each(studyCategoryCases)(
      'should fail when resources field is assigned while creating %p',
      async (studyPrefix, studyCategory) => {
        const researcherSession = await setup.createResearcherSession();
        const studyId = setup.gen.string({ prefix: `create-study-test-${studyPrefix}-resources` });

        await expect(
          researcherSession.resources.studies.create({
            id: studyId,
            resources: [{ arn: 'arn:aws:s3:::someRandomStudyArn' }],
            category: studyCategory,
          }),
        ).rejects.toMatchObject({
          code: errorCode.http.code.forbidden,
        });
      },
    );

    it.each(studyCategoryCases)(
      'should fail if inactive user tries to create %p',
      async (studyPrefix, studyCategory) => {
        const researcherSession = await setup.createResearcherSession();
        const studyId = setup.gen.string({ prefix: `create-study-test-inactive-user-${studyPrefix}` });

        await adminSession.resources.users.deactivateUser(researcherSession.user);

        await expect(
          researcherSession.resources.studies.create({ id: studyId, category: studyCategory }),
        ).rejects.toMatchObject({
          code: errorCode.http.code.unauthorized,
        });
      },
    );

    it.each(studyCategoryCases)(
      'should fail if internal guest tries to create %p',
      async (studyPrefix, studyCategory) => {
        const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
        const studyId = setup.gen.string({ prefix: `create-study-test-int-guest-${studyPrefix}` });

        await expect(
          guestSession.resources.studies.create({ id: studyId, category: studyCategory }),
        ).rejects.toMatchObject({
          code: errorCode.http.code.forbidden,
        });
      },
    );

    it.each(studyCategoryCases)(
      'should fail if external guest tries to create %p',
      async (studyPrefix, studyCategory) => {
        const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
        const studyId = setup.gen.string({ prefix: `create-study-test-ext-guest-${studyPrefix}` });

        await expect(
          guestSession.resources.studies.create({ id: studyId, category: studyCategory }),
        ).rejects.toMatchObject({
          code: errorCode.http.code.forbidden,
        });
      },
    );

    it.each(studyCategoryCases)(
      'should fail for anonymous user who tries to create %p',
      async (studyPrefix, studyCategory) => {
        const anonymousSession = await setup.createAnonymousSession();
        const studyId = setup.gen.string({ prefix: `create-study-test-anon-user-${studyPrefix}` });
        await expect(
          anonymousSession.resources.studies.create({ id: studyId, category: studyCategory }),
        ).rejects.toMatchObject({
          code: errorCode.http.code.badImplementation,
        });
      },
    );

    it.each(studyCategoryCases)(
      'should pass for researcher who tries to create %p',
      async (studyPrefix, studyCategory) => {
        const researcherSession = await setup.createResearcherSession();
        const studyId = setup.gen.string({ prefix: `create-study-test-researcher-${studyPrefix}` });

        await expect(
          researcherSession.resources.studies.create({ id: studyId, category: studyCategory }),
        ).resolves.toMatchObject({
          id: studyId,
        });
      },
    );
  });

  describe('Create BYOB study', () => {
    it('should fail for admin to create an unregistered BYOB study', async () => {
      const admin2Session = await setup.createAdminSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob' });
      const study = {
        id,
        adminUsers: [admin2Session.user.uid],
        accountId,
        bucket: bucketName,
      };

      await expect(admin2Session.resources.studies.create(study)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail if researcher creates an BYOB study', async () => {
      const researcherSession = await setup.createResearcherSession();
      const id = setup.gen.string({ prefix: 'update-study-test-byob-researcher' });
      const study = {
        id,
        adminUsers: [researcherSession.user.uid],
        accountId,
        bucket: bucketName,
      };

      await expect(researcherSession.resources.studies.create(study)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail if internal guest creates an BYOB study', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'internal-guest', projectId: [] });
      const id = setup.gen.string({ prefix: 'update-study-test-byob-int-guest' });
      const study = {
        id,
        adminUsers: [guestSession.user.uid],
        accountId,
        bucket: bucketName,
      };

      await expect(guestSession.resources.studies.create(study)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail if external guest creates an BYOB study', async () => {
      const guestSession = await setup.createUserSession({ userRole: 'guest', projectId: [] });
      const id = setup.gen.string({ prefix: 'update-study-test-byob-ext-guest' });
      const study = {
        id,
        adminUsers: [guestSession.user.uid],
        accountId,
        bucket: bucketName,
      };

      await expect(guestSession.resources.studies.create(study)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });
  });
});
