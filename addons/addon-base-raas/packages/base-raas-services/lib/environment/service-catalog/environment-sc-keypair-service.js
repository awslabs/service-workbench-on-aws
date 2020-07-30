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

const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  paramStoreRoot: 'paramStoreRoot',
};

class EnvironmentScKeypairService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'environmentScService', 'auditWriterService']);
  }

  async create(requestContext, id) {
    const [environmentScService] = await this.service(['environmentScService']);

    // The "environmentScService.getClientSdkWithEnvMgmtRole" call below will only succeed, if the user has permissions
    // to access the specified environment.
    const [ec2, ssm] = await Promise.all([
      environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id },
        { clientName: 'EC2', options: { apiVersion: '2016-11-15' } },
      ),
      environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id },
        { clientName: 'SSM', options: { apiVersion: '2014-11-06' } },
      ),
    ]);

    // The "id" is environment id as well as the ec2 keypair name
    const keyPair = await ec2.createKeyPair({ KeyName: id }).promise();
    await ssm
      .putParameter({
        Name: this.toPrivateKeySsmParamName(id),
        Type: 'SecureString',
        Value: keyPair.KeyMaterial,
        Description: `admin private key for environment ${id}`,
        Overwrite: true,
      })
      .promise();

    const keyName = keyPair.KeyName;

    // Write audit event
    await this.audit(requestContext, { action: 'create-environment-sc-keypair', body: { keyName } });

    return keyName;
  }

  async mustFind(requestContext, id) {
    const [environmentScService] = await this.service(['environmentScService']);

    // The "environmentScService.getClientSdkWithEnvMgmtRole" call below will only succeed, if the user has permissions
    // to access the specified environment.
    // The "id" is environment id as well as the ec2 keypair name
    const ssm = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id },
      { clientName: 'SSM', options: { apiVersion: '2014-11-06' } },
    );
    const privateKey = await ssm
      .getParameter({
        Name: this.toPrivateKeySsmParamName(id),
        WithDecryption: true,
      })
      .promise();
    return { privateKey: privateKey.Parameter.Value };
  }

  async delete(requestContext, id) {
    const [environmentScService] = await this.service(['environmentScService']);

    // The "environmentScService.getClientSdkWithEnvMgmtRole" call below will only succeed, if the user has permissions
    // to access the specified environment.
    const [ec2, ssm] = await Promise.all([
      environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id },
        { clientName: 'EC2', options: { apiVersion: '2016-11-15' } },
      ),
      environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id },
        { clientName: 'SSM', options: { apiVersion: '2014-11-06' } },
      ),
    ]);

    // The "id" is environment id as well as the ec2 keypair name
    await ec2.deleteKeyPair({ KeyName: id }).promise();
    await ssm
      .deleteParameter({ Name: this.toPrivateKeySsmParamName(id) })
      .promise()
      .catch((e) => {
        // Nothing to do if ParameterNotFound, rethrow any other errors
        if (e.code !== 'ParameterNotFound') {
          throw e;
        }
      });

    // Write audit event
    await this.audit(requestContext, { action: 'delete-environment-sc-keypair', body: { keyName: id } });

    return true;
  }

  toPrivateKeySsmParamName(envId) {
    return `/${this.settings.get(settingKeys.paramStoreRoot)}/sc-environments/${envId}`;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }
}

module.exports = EnvironmentScKeypairService;
