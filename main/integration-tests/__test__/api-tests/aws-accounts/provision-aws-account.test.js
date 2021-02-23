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

describe('Update AWS Account scenarios', () => {
  let setup;

  beforeAll(async () => {
    setup = await runSetup();
  });

  afterAll(async () => {
    await setup.cleanup();
  });

  describe('Provisioning an AWS Account', () => {
    it('should fail if the body does not contain required fields', async () => {
      const admin2Session = await setup.createAdminSession();
      const genParams = { prefix: 'create-aws-account-test-req-fields' };
      const requestBody = {
        name: setup.gen.string(genParams),
        roleArn: setup.gen.string(genParams),
        externalId: setup.gen.string(genParams),

        // Other required params are:
        // accountId,vpcId,subnetId,encryptionKeyArn
      };

      await expect(admin2Session.resources.awsAccounts.provision(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.badRequest,
      });
    });

    it('should fail when non-admin user is trying to provision AWS Account', async () => {
      const researcherSession = await setup.createResearcherSession();
      const genParams = { prefix: 'create-aws-account-test-non-admin' };
      const requestBody = {
        name: setup.gen.string(genParams),
        roleArn: setup.gen.string(genParams),
        externalId: setup.gen.string(genParams),
        accountId: setup.gen.string(genParams),
        vpcId: setup.gen.string(genParams),
        subnetId: setup.gen.string(genParams),
        encryptionKeyArn: setup.gen.string(genParams),
      };

      await expect(researcherSession.resources.awsAccounts.provision(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.forbidden,
      });
    });

    it('should fail for anonymous user', async () => {
      const genParams = { prefix: 'create-aws-account-anon-user' };
      const requestBody = {
        name: setup.gen.string(genParams),
        roleArn: setup.gen.string(genParams),
        externalId: setup.gen.string(genParams),
        accountId: setup.gen.string(genParams),
        vpcId: setup.gen.string(genParams),
        subnetId: setup.gen.string(genParams),
        encryptionKeyArn: setup.gen.string(genParams),
      };

      const anonymousSession = await setup.createAnonymousSession();
      await expect(anonymousSession.resources.awsAccounts.provision(requestBody)).rejects.toMatchObject({
        code: errorCode.http.code.badImplementation,
      });
    });
  });
});
