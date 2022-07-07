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

const Service = require('@amzn/base-services-container/lib/service');

const settingKeys = {
  paramStoreRoot: 'paramStoreRoot',
};

class EnvironmentKeypairService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'environmentService', 'auditWriterService']);
  }

  async create(requestContext, id, credentials) {
    const [aws, environmentService] = await this.service(['aws', 'environmentService']);

    // The call below will only succeed if the user has access to the specified environment and if the environment exists.
    // This is to prevent users from creating keypairs for non-existing environments or environments they do not have
    // access to
    const environment = await environmentService.mustFind(requestContext, { id });

    const ec2 = new aws.sdk.EC2(credentials);

    // The "id" is environment id as well as the ec2 keypair name
    const keyPair = await ec2.createKeyPair({ KeyName: id }).promise();

    const ssm = new aws.sdk.SSM(credentials);
    const parameterName = `/${this.settings.get(settingKeys.paramStoreRoot)}/environments/${id}`;
    await ssm
      .putParameter({
        Name: parameterName,
        Type: 'SecureString',
        Value: keyPair.KeyMaterial,
        Description: `ssh key for environment ${environment.id}`,
        Overwrite: true,
      })
      .promise();

    const keyName = keyPair.KeyName;

    // Write audit event
    await this.audit(requestContext, { action: 'create-environment-keypair', body: { keyName } });

    return keyName;
  }

  async mustFind(requestContext, id) {
    const [aws, environmentService] = await this.service(['aws', 'environmentService']);

    // The "environmentService.credsForAccountWithEnvironment" call below will only succeed, if the user has permissions
    // to access the specified environment.
    // The "id" is environment id as well as the ec2 keypair name
    const ssm = new aws.sdk.SSM(await environmentService.credsForAccountWithEnvironment(requestContext, { id }));
    const parameterName = `/${this.settings.get(settingKeys.paramStoreRoot)}/environments/${id}`;
    const privateKey = await ssm
      .getParameter({
        Name: parameterName,
        WithDecryption: true,
      })
      .promise();

    return { privateKey: privateKey.Parameter.Value };
  }

  async delete(requestContext, id, credentials) {
    const [aws, environmentService] = await this.service(['aws', 'environmentService']);

    // The call below will only succeed if the user has access to the specified environment and if the environment exists.
    // This is to prevent users from deleting any random key-pairs.
    // They are allowed to delete only key-pairs for environments they have access to
    // The "id" is environment id as well as the ec2 key-pair name
    const environment = await environmentService.mustFind(requestContext, { id });

    const ec2 = new aws.sdk.EC2(credentials);
    const ssm = new aws.sdk.SSM(credentials);
    const parameterName = `/${this.settings.get(settingKeys.paramStoreRoot)}/environments/${id}`;

    // The "id" is environment id as well as the ec2 keypair name
    await ec2.deleteKeyPair({ KeyName: environment.id }).promise();

    await ssm
      .deleteParameter({
        Name: parameterName,
      })
      .promise();

    // Write audit event
    await this.audit(requestContext, { action: 'delete-environment-keypair', body: { keyName: environment.id } });

    return true;
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

module.exports = EnvironmentKeypairService;
