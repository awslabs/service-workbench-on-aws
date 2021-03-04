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

describe('Delete index scenarios', () => {
  let setup;
  let adminSession;

  beforeAll(async () => {
    setup = await runSetup();
    adminSession = await setup.defaultAdminSession();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Deleting an index', () => {
    it('should fail if admin is inactive', async () => {
      const testIndexId = setup.gen.string({ prefix: `delete-index-test-inactive-admin` });
      const newIndex = await adminSession.resources.indexes.create({
        id: testIndexId,
        awsAccountId: setup.defaults.index.awsAccountId,
      });

      const admin2Session = await setup.createAdminSession();
      await adminSession.resources.users.deactivateUser(admin2Session.user);

      await expect(admin2Session.resources.indexes.index(newIndex.id).delete()).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if non-admin user is trying to delete index', async () => {
      const testIndexId = setup.gen.string({ prefix: `delete-index-test-non-admin` });
      const newIndex = await adminSession.resources.indexes.create({
        id: testIndexId,
        awsAccountId: setup.defaults.index.awsAccountId,
      });

      const researcherSession = await setup.createResearcherSession();

      await expect(researcherSession.resources.indexes.index(newIndex.id).delete()).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const testIndexId = setup.gen.string({ prefix: `delete-index-test-anon-user` });
      const newIndex = await adminSession.resources.indexes.create({
        id: testIndexId,
        awsAccountId: setup.defaults.index.awsAccountId,
      });
      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.indexes.index(newIndex.id).delete()).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
