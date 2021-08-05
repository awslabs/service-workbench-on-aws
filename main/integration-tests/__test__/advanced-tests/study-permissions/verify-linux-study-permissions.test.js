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
const { NodeSSH } = require('node-ssh');
const { mountStudies, readWrite } = require('../../../support/complex/run-shell-command');
const { runSetup } = require('../../../support/setup');
const { getIdToken } = require('../../../support/utils/id-token');

describe('EC2 Linux scenarios', () => {
  let setup;
  let ssh;

  async function newToken() {
    const content = setup.settings.content;
    setup.settings.content.adminIdToken = await getIdToken({
      username: content.username,
      password: content.password,
      apiEndpoint: content.apiEndpoint,
      authenticationProviderId: content.authenticationProviderId,
    });
    console.log(setup.settings.content.adminIdToken);
  }
  async function testSetup() {
    const adminSession = await setup.createAdminSession();
    const admin2Session = await setup.createAdminSession();
    await newToken();
    const keyPair = await admin2Session.resources.keyPairs.create();
    return { adminSession, admin2Session, keyPair };
  }

  beforeAll(async () => {
    setup = await runSetup();
    ssh = new NodeSSH();
    jest.retryTimes(0);
  });
  afterAll(async () => {
    await newToken();
    await setup.cleanup();
  });

  describe('Updates to mounted study permissions', () => {
    it('should propagate for Org Study', async () => {
      const { adminSession, admin2Session, keyPair } = await testSetup();
      const studyId = setup.gen.string({ prefix: `create-org-study-test` });
      await adminSession.resources.studies.create({ id: studyId, name: studyId, category: 'Organization' });
      await adminSession.resources.studies
        .study(studyId)
        .propagatePermission(admin2Session, ['admin', 'readwrite'], []);

      const workspaceName = setup.gen.string({ prefix: 'workspace-sc-test' });

      const env = await admin2Session.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: setup.defaults.envTypes.ec2Linux.envTypeId,
        envTypeConfigId: setup.defaults.envTypes.ec2Linux.envTypeConfigId,
        studyIds: [studyId],
        description: 'test',
        projectId: setup.defaults.project.id,
        cidr: '0.0.0.0/0',
      });
      // Poll until workspace is provisioned
      await sleep(2000);
      await adminSession.resources.workflows
        .versions('wf-provision-environment-sc')
        .version(1)
        .findAndPollWorkflow(env.id, 10000, 48);

      // Connect to workspace
      const networkInfo = await admin2Session.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(env.id) // env.id
        .connections()
        .connection('id-1')
        .sendSshPublicKey({ keyPairId: keyPair.id });

      await ssh.connect({
        host: networkInfo.networkInterfaces[0].publicDnsName,
        username: 'ec2-user',
        privateKey: keyPair.privateKey,
      });

      // Mount studies
      let output;
      output = await mountStudies(ssh, studyId);
      // console.log(`STDOUT:\n${output.stdout}\n\nSTDERR:\n${output.stderr}`);

      // Readwrite permission level
      output = await readWrite(ssh, studyId);
      expect(output.stdout).toEqual(expect.stringMatching(/ec2-user 20/));

      // Admin permission level
      await adminSession.resources.studies.study(studyId).propagatePermission(admin2Session, ['admin'], ['readwrite']);
      output = await readWrite(ssh, studyId);
      expect(output.stderr).toEqual(expect.stringMatching(/write error: Permission denied/));

      // Readonly permission level
      await adminSession.resources.studies.study(studyId).propagatePermission(admin2Session, ['readonly'], ['admin']);
      output = await readWrite(ssh, studyId);
      expect(output.stderr).toEqual(expect.stringMatching(/write error: Permission denied/));

      // None permission level
      await adminSession.resources.studies.study(studyId).propagatePermission(admin2Session, [], ['readonly']);
      output = await readWrite(ssh, studyId);
      expect(output.stderr).toEqual(expect.stringMatching(/reading directory .: Permission denied/));

      await ssh.dispose();
      await newToken();
      await setup.cleanup();
    });

    it('should propagate for BYOB Study', async () => {
      const { adminSession, admin2Session, keyPair } = await testSetup();
      const externalStudy = setup.defaults.byobStudy;
      const workspaceName = setup.gen.string({ prefix: 'workspace-sc-test' });
      await adminSession.resources.studies.study(externalStudy).propagatePermission(admin2Session, ['readwrite'], []);

      const env = await admin2Session.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: setup.defaults.envTypes.ec2Linux.envTypeId,
        envTypeConfigId: setup.defaults.envTypes.ec2Linux.envTypeConfigId,
        studyIds: [externalStudy],
        description: 'test',
        projectId: setup.defaults.project.id,
        cidr: '0.0.0.0/0',
      });
      // Poll until workspace is provisioned
      await sleep(2000);
      await adminSession.resources.workflows
        .versions('wf-provision-environment-sc')
        .version(1)
        .findAndPollWorkflow(env.id, 10000, 48);
      // Connect to workspace
      const networkInfo = await admin2Session.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(env.id) // env.id
        .connections()
        .connection('id-1')
        .sendSshPublicKey({ keyPairId: keyPair.id });

      await ssh.connect({
        host: networkInfo.networkInterfaces[0].publicDnsName,
        username: 'ec2-user',
        privateKey: keyPair.privateKey,
      });

      // Mount studies
      let output;
      output = await mountStudies(ssh, externalStudy);
      // console.log(`STDOUT:\n${output.stdout}\n\nSTDERR:\n${output.stderr}`);

      // Readwrite permission level
      output = await readWrite(ssh, externalStudy);
      expect(output.stdout).toEqual(expect.stringMatching(/ec2-user 20/));

      // Readonly permission level
      await adminSession.resources.studies
        .study(externalStudy)
        .propagatePermission(admin2Session, ['readonly'], ['readwrite']);
      output = await readWrite(ssh, externalStudy);
      expect(output.stderr).toEqual(expect.stringMatching(/reading directory .: Permission denied/));

      await ssh.dispose();
      // Removes user permission
      await adminSession.resources.studies.study(externalStudy).propagatePermission(admin2Session, [], ['readonly']);
      await newToken();
      await setup.cleanup();
    });
  });

  describe('Confirm study permissions', () => {
    it('should pass for My Study', async () => {
      const { adminSession, admin2Session, keyPair } = await testSetup();
      const studyId = setup.gen.string({ prefix: `create-my-study-test` });
      await admin2Session.resources.studies.create({ id: studyId, name: studyId, category: 'My Studies' });

      const workspaceName = setup.gen.string({ prefix: 'workspace-sc-test' });
      const env = await admin2Session.resources.workspaceServiceCatalogs.create({
        name: workspaceName,
        envTypeId: setup.defaults.envTypes.ec2Linux.envTypeId,
        envTypeConfigId: setup.defaults.envTypes.ec2Linux.envTypeConfigId,
        studyIds: [studyId],
        description: 'test',
        projectId: setup.defaults.project.id,
        cidr: '0.0.0.0/0',
      });

      // Poll until workspace is provisioned
      await sleep(2000);
      await adminSession.resources.workflows
        .versions('wf-provision-environment-sc')
        .version(1)
        .findAndPollWorkflow(env.id, 10000, 48);

      // Connect to workspace
      const networkInfo = await admin2Session.resources.workspaceServiceCatalogs
        .workspaceServiceCatalog(env.id) // env.id
        .connections()
        .connection('id-1')
        .sendSshPublicKey({ keyPairId: keyPair.id });

      await ssh.connect({
        host: networkInfo.networkInterfaces[0].publicDnsName,
        username: 'ec2-user',
        privateKey: keyPair.privateKey,
      });

      const output = await mountStudies(ssh, studyId);
      expect(output.stdout).toEqual(expect.stringMatching(/output.txt/));
      await newToken();
      await setup.cleanup();
    });
  });
});
