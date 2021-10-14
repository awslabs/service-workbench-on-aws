/* eslint-disable no-await-in-loop */
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

const { sleep } = require('@aws-ee/base-services/lib/helpers/utils');
const { runSetup } = require('../../../../support/setup');

const {
  createWorkspaceTypeAndConfiguration,
} = require('../../../../support/complex/create-workspace-type-and-configuration');
const {
  createDefaultServiceCatalogProduct,
  deleteDefaultServiceCatalogProduct,
} = require('../../../../support/complex/default-integration-test-product');
const errorCode = require('../../../../support/utils/error-code');

describe('Create workspace-service-catalog scenarios', () => {
  let setup;
  let adminSession;
  let productInfo;

  beforeAll(async () => {
    setup = await runSetup();

    adminSession = await setup.defaultAdminSession();
    productInfo = await createDefaultServiceCatalogProduct(setup);
    jest.retryTimes(1);
  });

  afterAll(async () => {
    await deleteDefaultServiceCatalogProduct(setup, productInfo);
    await setup.cleanup();
  });

  describe('Create workspace-service-catalog', () => {
    it('should fail if user is inactive', async () => {
      const adminSession2 = await setup.createAdminSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      await adminSession2.resources.users.deactivateUser(adminSession2.user);

      await expect(
        adminSession2.resources.workspaceServiceCatalogs.create({
          name: workspaceName,
          envTypeId: workspaceTypeId,
          envTypeConfigId: configurationId,
        }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.unauthorized,
      });
    });

    it('should fail if user is anonymous', async () => {
      const anonymousSession = await setup.createAnonymousSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      await expect(
        anonymousSession.resources.workspaceServiceCatalogs.create({
          name: workspaceName,
          envTypeId: workspaceTypeId,
          envTypeConfigId: configurationId,
        }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });

    it('should fail if user role is not allowed', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      await expect(
        researcherSession.resources.workspaceServiceCatalogs.create({
          name: workspaceName,
          envTypeId: workspaceTypeId,
          envTypeConfigId: configurationId,
          invalid: 'data',
        }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail if input is not valid', async () => {
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      await expect(
        adminSession.resources.workspaceServiceCatalogs.create({
          name: workspaceName,
          envTypeId: workspaceTypeId,
          envTypeConfigId: configurationId,
          invalid: 'data',
        }),
      ).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should create the service catalog workspace if admin', async () => {
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
      );

      await expect(
        adminSession.resources.workspaceServiceCatalogs.create({
          name: workspaceName,
          envTypeId: workspaceTypeId,
          envTypeConfigId: configurationId,
        }),
      ).resolves.toMatchObject({
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });
    });

    it('should create if user role is allowed', async () => {
      const researcherSession = await setup.createResearcherSession();
      const workspaceName = setup.gen.string({ prefix: 'workspace-service-catalog-test' });
      const { workspaceTypeId, configurationId } = await createWorkspaceTypeAndConfiguration(
        productInfo,
        adminSession,
        setup,
        ['researcher'],
      );

      await expect(
        researcherSession.resources.workspaceServiceCatalogs.create({
          name: workspaceName,
          envTypeId: workspaceTypeId,
          envTypeConfigId: configurationId,
        }),
      ).resolves.toMatchObject({
        envTypeId: workspaceTypeId,
        envTypeConfigId: configurationId,
      });
    });
  });
  describe('Workspace SC env with studies', () => {
    it('for EC2Linux should provision correctly', async () => {
      const admin1Session = await setup.createAdminSession();

      const studyIds = [];
      let studyId = setup.gen.string({ prefix: `create-study-ray-my-study` });
      await expect(
        admin1Session.resources.studies.create({ id: studyId, name: studyId, category: 'My Studies' }),
      ).resolves.toMatchObject({
        id: studyId,
      });
      studyIds.push(studyId);

      studyId = setup.gen.string({ prefix: `create-study-ray-org-study` });
      await expect(
        admin1Session.resources.studies.create({ id: studyId, name: studyId, category: 'Organization' }),
      ).resolves.toMatchObject({
        id: studyId,
      });
      studyIds.push(studyId);

      const workspaceName = setup.gen.string({ prefix: 'workspace-sc-test' });
      const body = {
        name: workspaceName,
        envTypeId: setup.defaults.envTypes.ec2Linux.envTypeId,
        envTypeConfigId: setup.defaults.envTypes.ec2Linux.envTypeConfigId,
        studyIds,
        description: 'assignment',
        projectId: setup.defaults.project.id,
        cidr: '123.123.123.123/12',
      };
      // AppStream enabled environments does not support CIDR
      if (setup.defaults.isAppStreamEnabled) {
        delete body.cidr;
      }
      const env = await admin1Session.resources.workspaceServiceCatalogs.create(body);
      expect(env).toMatchObject({
        name: workspaceName,
        envTypeId: setup.defaults.envTypes.ec2Linux.envTypeId,
        envTypeConfigId: setup.defaults.envTypes.ec2Linux.envTypeConfigId,
        studyIds,
      });

      // Poll until workspace is provisioned
      await sleep(2000);
      await admin1Session.resources.workflows
        .versions('wf-provision-environment-sc')
        .version(1)
        .findAndPollWorkflow(env.id, 10000, 60);
      await setup.cleanup();
    });
  });
});
