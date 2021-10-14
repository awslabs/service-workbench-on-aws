/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

class AppStreamScService extends Service {
  constructor() {
    super();
    this.dependency([
      'auditWriterService',
      'aws',
      'awsAccountsService',
      'environmentScKeypairService',
      'environmentScService',
      'indexesService',
    ]);
  }

  async init() {
    await super.init();
  }

  async shareAppStreamImageWithAccount(requestContext, accountId, appStreamImageName) {
    const appStream = await this.getAppStream();
    const result = await appStream
      .updateImagePermissions({
        ImagePermissions: {
          allowFleet: true,
          allowImageBuilder: false,
        },
        Name: appStreamImageName,
        SharedAccountId: accountId,
      })
      .promise();

    // Write audit event
    await this.audit(requestContext, { action: 'share-appstream-image-with-account', body: { accountId } });

    return result;
  }

  async getStackAndFleet(requestContext, { environmentId, indexId }) {
    const [environmentScService, awsAccountsService, indexesService] = await this.service([
      'environmentScService',
      'awsAccountsService',
      'indexesService',
    ]);

    // Find stack
    const { awsAccountId } = await indexesService.mustFind(requestContext, { id: indexId });
    const {
      appStreamStackName: stackName,
      accountId,
      appStreamFleetName: fleetName,
    } = await awsAccountsService.mustFind(requestContext, {
      id: awsAccountId,
    });

    if (!stackName) {
      throw this.boom.badRequest(`No AppStream stack is associated with the account ${accountId}`, true);
    }

    // Verify fleet is associated to appstream stack
    const appStream = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: environmentId },
      { clientName: 'AppStream', options: { signatureVersion: 'v4' } },
    );
    const { Names: fleetNames } = await appStream.listAssociatedFleets({ StackName: stackName }).promise();

    if (!_.includes(fleetNames, fleetName)) {
      throw this.boom.badRequest(
        `AppStream Fleet ${fleetName} is not associated with the AppStream stack ${stackName}`,
        true,
      );
    }

    return { stackName, fleetName };
  }

  generateSessionSuffix(environment) {
    // Generate a unique session suffix for the environment as a 6 character alphanumeric string
    // This is random looking but string but is deterministic so can be derived from the environment
    return (new Date(environment.createdAt).getTime() % 36 ** 6).toString(36);
  }

  generateUserId(requestContext, environment) {
    // UserId must match [\w+=,.@-]* with max length 32
    // Don't let the username be too long (otherwise the user won't be able to open multiple sessions)
    const uid = _.get(requestContext, 'principalIdentifier.uid');
    // Append a unique session suffix to the user id, this user id is used for creating unique AppStream session
    // appending suffix to make sure a unique session is created per environment per user
    const sessionSuffix = this.generateSessionSuffix(environment);
    return `${uid}-${sessionSuffix}`.replace(/[^\w+=,.@-]+/g, '').slice(0, 32);
  }

  async getStreamingUrl(requestContext, { environmentId, applicationId }) {
    const environmentScService = await this.service('environmentScService');

    const appStream = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: environmentId },
      { clientName: 'AppStream', options: { signatureVersion: 'v4' } },
    );

    const environment = await environmentScService.mustFind(requestContext, { id: environmentId });

    const { stackName, fleetName } = await this.getStackAndFleet(requestContext, {
      environmentId,
      indexId: environment.indexId,
    });

    let result = {};

    try {
      result = await appStream
        .createStreamingURL({
          FleetName: fleetName,
          StackName: stackName,
          UserId: this.generateUserId(requestContext, environment),
          ApplicationId: applicationId,
        })
        .promise();
    } catch (err) {
      throw this.boom.badRequest('There was an error generating AppStream URL', true);
    }

    // Write audit event
    await this.audit(requestContext, { action: 'appstream-firefox-app-url-requested', body: { environmentId } });

    return result.StreamingURL;
  }

  async urlForRemoteDesktop(requestContext, { environmentId, instanceId }) {
    const environmentScService = await this.service('environmentScService');
    const environment = await environmentScService.mustFind(requestContext, { id: environmentId });

    // Get stack and fleet
    const { stackName, fleetName } = await this.getStackAndFleet(requestContext, {
      environmentId,
      indexId: environment.indexId,
    });

    // Generate AppStream URL
    const appStream = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: environmentId },
      { clientName: 'AppStream', options: { signatureVersion: 'v4' } },
    );
    const ec2 = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: environmentId },
      { clientName: 'EC2', options: { apiVersion: '2016-11-15' } },
    );
    const data = await ec2.describeInstances({ InstanceIds: [instanceId] }).promise();
    const instanceInfo = _.get(data, 'Reservations[0].Instances[0]');
    const networkInterfaces = _.get(instanceInfo, 'NetworkInterfaces') || [];
    const privateIp = _.get(networkInterfaces[0], 'PrivateIpAddress');

    const userId = this.generateUserId(requestContext, environment);
    this.log.info({ msg: `Creating AppStream URL`, appStreamSessionUid: userId });

    let result = {};
    try {
      result = await appStream
        .createStreamingURL({
          FleetName: fleetName,
          StackName: stackName,
          UserId: userId,
          ApplicationId: 'MicrosoftRemoteDesktop',
          SessionContext: privateIp,
        })
        .promise();
    } catch (err) {
      throw this.boom.badRequest('There was an error generating AppStream URL', true);
    }

    // Write audit event
    await this.audit(requestContext, { action: 'appstream-remote-desktop-app-url-requested', body: { environmentId } });

    return result.StreamingURL;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }

  async getAppStream() {
    const aws = await this.getAWS();
    return new aws.sdk.AppStream();
  }
}

module.exports = AppStreamScService;
