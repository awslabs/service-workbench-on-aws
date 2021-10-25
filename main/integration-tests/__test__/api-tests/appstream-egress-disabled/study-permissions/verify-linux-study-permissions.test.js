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
const { mountStudies, readWrite } = require('../../../../support/complex/run-shell-command');
const { runSetup } = require('../../../../support/setup');

describe('EC2 Linux scenarios', () => {
  let setup;
  let ssh;
  async function testSetup() {
    const adminSession = await setup.createAdminSession();
    const admin2Session = await setup.createAdminSession();
    const keyPair = await admin2Session.resources.keyPairs.create();
    return { adminSession, admin2Session, keyPair };
  }

  beforeAll(async () => {
    setup = await runSetup();
    ssh = new NodeSSH();
  });
  afterAll(async () => {
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
        .findAndPollWorkflow(env.id, 10000, 60);

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

      // Readwrite permission level
      const numberOfBytes = 20;
      output = await readWrite(ssh, studyId, numberOfBytes);
      expect(output.stdout).toContain(`ec2-user ${numberOfBytes}`);

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
        .findAndPollWorkflow(env.id, 10000, 60);
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

      // Readwrite permission level
      const numberOfBytes = 20;
      output = await readWrite(ssh, externalStudy, numberOfBytes);
      expect(output.stdout).toContain(`ec2-user ${numberOfBytes}`);

      // Readonly permission level
      await adminSession.resources.studies
        .study(externalStudy)
        .propagatePermission(admin2Session, ['readonly'], ['readwrite']);
      output = await readWrite(ssh, externalStudy);
      expect(output.stderr).toEqual(expect.stringMatching(/reading directory .: Permission denied/));

      await ssh.dispose();
      // Removes user permission
      await adminSession.resources.studies.study(externalStudy).propagatePermission(admin2Session, [], ['readonly']);
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
        .findAndPollWorkflow(env.id, 10000, 60);

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
      await setup.cleanup();
    });
  });
});
