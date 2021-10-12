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

const _ = require('lodash');
let fetch = require('node-fetch');
const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const querystring = require('querystring');
const Service = require('@aws-ee/base-services-container/lib/service');
const { retry, linearInterval } = require('@aws-ee/base-services/lib/helpers/utils');
const sshConnectionInfoSchema = require('../../schema/ssh-connection-info-sc');
const { connectionScheme } = require('./environment-sc-connection-enum');
const { cfnOutputsToConnections } = require('./helpers/connections-util');

// Webpack messes with the fetch function import and it breaks in lambda.
if (typeof fetch !== 'function' && fetch.default && typeof fetch.default === 'function') {
  fetch = fetch.default;
}

class EnvironmentScConnectionService extends Service {
  constructor() {
    super();
    this.dependency([
      'environmentScService',
      'environmentScKeypairService',
      'environmentDnsService',
      'jsonSchemaValidationService',
      'jwtService',
      'keyPairService',
      'auditWriterService',
      'pluginRegistryService',
      'lockService',
      'aws',
    ]);
  }

  async init() {
    await super.init();
  }

  /**
   * Method to get connections information for the specified environment.
   *
   * The method returns an array of connections for the given environment with the shape
   * [{ name: STRING, url: STRING, scheme: STRING, type: STRING, info: STRING, instanceId: STRING }].
   *
   * The connections are derived based on the outputs as follows.
   * CFN outputs with the OutputKey having format "MetaConnection<ConnectionAttrib>" or "MetaConnection<N><ConnectionAttrib>"
   * are used for extracting connection information.
   * - If the environment has only one connection then it can have outputs with "MetaConnection<ConnectionAttrib>" format.
   * - If it has multiple connections then it can have outputs with "MetaConnection<N><ConnectionAttrib>" format.
   * For example, MetaConnection1Name, MetaConnection2Name, etc.
   *
   * The expected CFN output variables used for capturing connections related information are as follows:
   *
   * - MetaConnectionName (or MetaConnection<N>Name) - Provides name for connection
   *
   * - MetaConnectionUrl (or MetaConnection<N>Url) - Provides connection url, if available
   *
   * - MetaConnectionScheme (or MetaConnection<N>Scheme) - Provides connection protocol information such as http, https, ssh, rdp etc.
   *
   * - MetaConnectionType (or MetaConnection<N>Type) - Provides type of the connection such as "SageMaker", "EMR", "FOO", "BAR" etc.
   * Currently, only "SageMaker" is supported.
   *
   * - MetaConnectionInfo (or MetaConnection<N>Info) - Provides extra information required to form connection url.
   * For example, in case of MetaConnectionType = SageMaker, the MetaConnectionInfo should provide SageMaker notebook
   * instance name that can be used to form pre-signed SageMaker URL.
   *
   * - MetaConnectionInstanceId (or MetaConnection<N>InstanceId) - Provides AWS EC2 instanceId of the instance to connect to when applicable.
   * Currently this is applicable only when MetaConnectionScheme = 'ssh' or 'rdp'.
   * - In case of SSH: This instanceId will be used for sending user's SSH public key using AWS EC2 Instance Connect.
   * - In case of RDP: This instanceId will be used for fetching Windows Administrator user's password.
   *
   * @param envId Id of the environment to find connections for
   * @returns {Promise<*>}
   */
  async listConnections(requestContext, envId) {
    const [environmentScService, pluginRegistryService] = await this.service([
      'environmentScService',
      'pluginRegistryService',
    ]);
    // The following will succeed only if the user has permissions to access the specified environment
    const { outputs, projectId } = await environmentScService.mustFind(requestContext, { id: envId });

    // Verify environment is linked to an AppStream project when application has AppStream enabled
    await environmentScService.verifyAppStreamConfig(requestContext, projectId);

    // TODO: Handle case when connection is about an auto scaling group instead of specific instance
    const result = await cfnOutputsToConnections(outputs);

    // Give plugins chance to adjust the connection (such as connection url etc)
    const adjustedConnections = await Promise.all(
      _.map(result, async connection => {
        // This is done so that plugins know it was called during list connections cycle
        connection.operation = 'list';

        const pluginsResult = await pluginRegistryService.visitPlugins(
          'env-sc-connection-url',
          'createConnectionUrl',
          {
            payload: {
              envId,
              connection,
            },
          },
          { requestContext, container: this.container },
        );

        return _.get(pluginsResult, 'connection', connection);
      }),
    );
    return adjustedConnections;
  }

  async findConnection(requestContext, envId, connectionId) {
    // The following will succeed only if the user has permissions to access the specified environment
    const connections = await this.listConnections(requestContext, envId);
    const connection = _.find(connections, { id: connectionId });
    return connection;
  }

  async mustFindConnection(requestContext, envId, connectionId) {
    const connection = await this.findConnection(requestContext, envId, connectionId);
    if (_.isEmpty(connection)) {
      throw this.boom.notFound(`The connection with id "${connectionId}" was not found`, true);
    }
    return connection;
  }

  async createConnectionUrl(requestContext, envId, connectionId) {
    const [environmentScService, pluginRegistryService] = await this.service([
      'environmentScService',
      'pluginRegistryService',
    ]);

    // The following will succeed only if the user has permissions to access the specified environment
    // and connection
    const connection = await this.mustFindConnection(requestContext, envId, connectionId);

    // Write audit event
    await this.audit(requestContext, { action: 'env-presigned-url-requested', body: { id: envId, connection } });

    if (!_.isEmpty(connection.url)) {
      // if connection already has url then just return it
      return connection;
    }

    // Verify environment is linked to an AppStream project when application has AppStream enabled
    const { projectId } = await environmentScService.mustFind(requestContext, { id: envId });
    await environmentScService.verifyAppStreamConfig(requestContext, projectId);

    if (_.toLower(_.get(connection, 'type', '')) === 'sagemaker') {
      const sagemaker = await environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id: envId },
        { clientName: 'SageMaker', options: { apiVersion: '2017-07-24' } },
      );

      const params = {
        NotebookInstanceName: connection.info,
      };
      const sageMakerResponse = await sagemaker.createPresignedNotebookInstanceUrl(params).promise();

      connection.url = _.get(sageMakerResponse, 'AuthorizedUrl');
    }

    if (_.toLower(_.get(connection, 'type', '')) === 'rstudio') {
      connection.url = await this.getRStudioUrl(requestContext, envId, connection);
    }

    // This is done so that plugins know it was called during create URL cycle
    connection.operation = 'create';
    // Give plugins chance to adjust the connection (such as connection url etc)
    const result = await pluginRegistryService.visitPlugins(
      'env-sc-connection-url',
      'createConnectionUrl',
      {
        payload: {
          envId,
          connection,
        },
      },
      { requestContext, container: this.container },
    );

    return _.get(result, 'connection') || connection;
  }

  async getRStudioUrl(requestContext, id, connection) {
    const environmentDnsService = await this.service('environmentDnsService');
    const rstudioDomainName = environmentDnsService.getHostname('rstudio', id);
    const rstudioSignInUrl = `https://${rstudioDomainName}/auth-do-sign-in`;
    const instanceId = connection.instanceId;
    const jwtService = await this.service('jwtService');
    const jwtSecret = await jwtService.getSecret();
    const hash = crypto.createHash('sha256');
    const username = 'rstudio-user';
    const password = hash.update(`${instanceId}${jwtSecret}`).digest('hex');
    const credentials = `${username}\n${password}`;
    const publicKey = await this.getRstudioPublicKey(requestContext, instanceId, id);
    const [exponent, modulus] = publicKey.split(':', 2);
    const exponentBuffer = Buffer.from(exponent, 'hex');
    const modulusBuffer = Buffer.from(modulus, 'hex');
    const key = new NodeRSA();
    const publicKeyObject = key.importKey({ n: modulusBuffer, e: exponentBuffer }, 'components-public');
    const payloadBuffer = Buffer.from(credentials);
    const result = crypto.publicEncrypt(
      { key: publicKeyObject.exportKey('public'), padding: crypto.constants.RSA_PKCS1_PADDING },
      payloadBuffer,
    );
    const params = { v: result.toString('base64') };
    const authorizedUrl = `${rstudioSignInUrl}?${querystring.encode(params)}`;
    return authorizedUrl;
  }

  async getRstudioPublicKey(requestContext, instanceId, id) {
    const environmentScService = await this.service('environmentScService');

    const ssm = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id },
      { clientName: 'SSM', options: { apiVersion: '2014-11-06' } },
    );
    const rstudioPublicKey = await ssm
      .getParameter({
        Name: `/rstudio/publickey/sc-environments/ec2-instance/${instanceId}`,
        WithDecryption: true,
      })
      .promise();

    return rstudioPublicKey.Parameter.Value;
  }

  async sendSshPublicKey(requestContext, envId, connectionId, sshConnectionInfo) {
    const [environmentScService, keyPairService, validationService] = await this.service([
      'environmentScService',
      'keyPairService',
      'jsonSchemaValidationService',
    ]);

    // Validate input
    await validationService.ensureValid(sshConnectionInfo, sshConnectionInfoSchema);

    // Verify environment is linked to an AppStream project when application has AppStream enabled
    const { projectId } = await environmentScService.mustFind(requestContext, { id: envId });
    await environmentScService.verifyAppStreamConfig(requestContext, projectId);

    // The following will succeed only if the user has permissions to access the specified environment
    const connection = await this.mustFindConnection(requestContext, envId, connectionId);

    if (connection.scheme !== connectionScheme.ssh) {
      throw this.boom.badRequest(
        `The connection "${connectionId}" does not support SSH. Please contact your administrator.`,
        true,
      );
    }
    if (_.isEmpty(connection.instanceId)) {
      throw this.boom.badRequest(
        `Could not determine the EC2 instance to SSH to for the connection "${connectionId}". This is most likely due to incorrect AWS CloudFormation output. Please contact your administrator.`,
        true,
      );
    }

    const { keyPairId } = sshConnectionInfo;
    // keyPairService.mustFind will only succeed if the caller has permissions to read the key with keyPairId
    const { publicKey, status } = await keyPairService.mustFind(requestContext, { id: keyPairId });
    if (_.toLower(status) !== 'active') {
      throw this.boom.badRequest(`Cannot use key pair ${keyPairId}. The key is not active.`, true);
    }

    const instanceId = connection.instanceId;

    const [ec2Sdk, ec2InstanceConnectSdk] = await Promise.all([
      environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id: envId },
        { clientName: 'EC2', options: { apiVersion: '2016-11-15' } },
      ),
      environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id: envId },
        { clientName: 'EC2InstanceConnect', options: { apiVersion: '2018-04-02' } },
      ),
    ]);

    const data = await ec2Sdk.describeInstances({ InstanceIds: [instanceId] }).promise();
    const instanceInfo = _.get(data, 'Reservations[0].Instances[0]');
    const instanceAz = _.get(instanceInfo || {}, 'Placement.AvailabilityZone');

    await ec2InstanceConnectSdk
      .sendSSHPublicKey({
        AvailabilityZone: instanceAz,
        InstanceId: instanceId,
        InstanceOSUser: sshConnectionInfo.instanceOsUser || 'ec2-user', // This should be the user you wish to be when ssh-ing to the instance (eg, ec2-user@[instance IP]). Defaults to "ec2-user"
        SSHPublicKey: publicKey,
      })
      .promise();

    // Write audit event
    await this.audit(requestContext, {
      action: 'env-send-ssh-public-key',
      body: { id: envId, connection },
    });

    // Return information about network interfaces of the instance so user can SSH to it
    return {
      networkInterfaces: this.toNetworkInterfaces(instanceInfo),
    };
  }

  async getWindowsPasswordDataForRdp(requestContext, envId, connectionId) {
    const [environmentScService, environmentScKeypairService] = await this.service([
      'environmentScService',
      'environmentScKeypairService',
    ]);

    // Verify environment is linked to an AppStream project when application has AppStream enabled
    const { projectId } = await environmentScService.mustFind(requestContext, { id: envId });
    await environmentScService.verifyAppStreamConfig(requestContext, projectId);

    // The following will succeed only if the user has permissions to access the specified environment
    // and connection
    const connection = await this.mustFindConnection(requestContext, envId, connectionId);

    if (connection.scheme !== connectionScheme.rdp) {
      throw this.boom.badRequest(
        `The connection "${connectionId}" does not support RDP. Cannot retrieve windows password. The retrieval of windows password is only supported for RDP connections. Please contact your administrator.`,
        true,
      );
    }
    if (_.isEmpty(connection.instanceId)) {
      throw this.boom.badRequest(
        `Could not determine the EC2 instance to RDP to for the connection "${connectionId}". This is most likely due to incorrect AWS CloudFormation output. Please contact your administrator.`,
        true,
      );
    }

    const ec2 = await environmentScService.getClientSdkWithEnvMgmtRole(
      requestContext,
      { id: envId },
      { clientName: 'EC2', options: { apiVersion: '2016-11-15' } },
    );

    const { PasswordData: passwordData } = await ec2.getPasswordData({ InstanceId: connection.instanceId }).promise();
    const { privateKey } = await environmentScKeypairService.mustFind(requestContext, envId);

    const password = crypto
      .privateDecrypt(
        { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(passwordData, 'base64'),
      )
      .toString('utf8');

    // Write audit event
    await this.audit(requestContext, { action: 'env-windows-password-requested', body: { id: envId, connection } });

    const data = await ec2.describeInstances({ InstanceIds: [connection.instanceId] }).promise();
    const instanceInfo = _.get(data, 'Reservations[0].Instances[0]');

    return { password, networkInterfaces: this.toNetworkInterfaces(instanceInfo) };
  }

  async createPrivateSageMakerUrl(requestContext, envId, connection, presign_retries = 10) {
    const lockService = await this.service('lockService');
    const signedURL = await lockService.tryWriteLockAndRun({ id: `${envId}presign` }, async () => {
      if (!(_.toLower(_.get(connection, 'type', '')) === 'sagemaker')) {
        throw this.boom.badRequest(
          `Cannot generate presigned URL for non-sagemaker connection ${connection.type}`,
          true,
        );
      }
      const environmentScService = await this.service('environmentScService');
      const iam = await environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id: envId },
        { clientName: 'IAM', options: { apiVersion: '2017-07-24' } },
      );
      const currentPolicyResponse = await this.getCurrentRolePolicy(iam, connection);
      await this.updateRoleToIncludeCurrentIP(iam, connection, currentPolicyResponse);
      const createPresignedURLFn = async () => {
        const stsEnvMgmt = await environmentScService.getClientSdkWithEnvMgmtRole(
          requestContext,
          { id: envId },
          { clientName: 'STS', options: { apiVersion: '2017-07-24' } },
        );
        const sageMakerResponse = await this.createPresignedURL(stsEnvMgmt, connection);
        return sageMakerResponse;
      };
      try {
        // Give sufficient number of retries to create presigned URL.
        // This is needed because IAM role takes a while to propagate
        // call with a linear strategy where we wait 2 seconds between retries
        // This makes it 20 seconds with default of 10 retries
        const sageMakerResponse = await retry(createPresignedURLFn, presign_retries, () => linearInterval(1, 2000));
        return _.get(sageMakerResponse, 'AuthorizedUrl');
      } catch (error) {
        throw this.boom.internalError(`Could not generate presigned URL`, true).cause(error);
      } finally {
        // restore the original policy document. This ensures that caller IP address which was responsible for
        // creating the presigned URL doesn't have access
        const oldPolicyDocument = decodeURIComponent(currentPolicyResponse.PolicyDocument);
        await this.putRolePolicy(iam, connection, oldPolicyDocument);
      }
    });
    return signedURL;
  }

  async getCurrentRolePolicy(iam, connection) {
    const currentPolicyResponse = await iam
      .getRolePolicy({
        RoleName: connection.role,
        PolicyName: connection.policy,
      })
      .promise();
    return currentPolicyResponse;
  }

  async updateRoleToIncludeCurrentIP(iam, connection, currentPolicyResponse) {
    // Construct new statement which will allow the caller IP address permission to generate the presigned URL
    const currentIpAddress = await fetch('http://checkip.amazonaws.com/').then(function(res) {
      return res.text();
    });
    const newStatement = {
      Effect: 'Allow',
      Action: 'sagemaker:CreatePresignedNotebookInstanceUrl',
      Resource: `${connection.notebookArn}`,
      Condition: {
        IpAddress: {
          'aws:SourceIp': `${currentIpAddress.trim()}/32`,
        },
      },
    };
    const policyToUpdate = JSON.parse(decodeURIComponent(currentPolicyResponse.PolicyDocument));
    let policyToUpdateStatement = policyToUpdate.Statement;
    if (_.isArray(policyToUpdateStatement)) {
      policyToUpdateStatement.push(newStatement);
    } else {
      policyToUpdateStatement = [policyToUpdateStatement, newStatement];
      policyToUpdate.Statement = policyToUpdateStatement;
    }
    await this.putRolePolicy(iam, connection, JSON.stringify(policyToUpdate));
  }

  async putRolePolicy(iam, connection, policyDocument) {
    const putRolePolicyParams = {
      RoleName: connection.role,
      PolicyName: connection.policy,
      PolicyDocument: policyDocument,
    };
    await iam.putRolePolicy(putRolePolicyParams).promise();
  }

  async createPresignedURL(stsEnvMgmt, connection) {
    const {
      Credentials: { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken },
    } = await stsEnvMgmt
      .assumeRole({
        RoleArn: connection.roleArn,
        RoleSessionName: `create-presigned-url`,
      })
      .promise();
    const aws = await this.getAWS();
    const sagemaker = new aws.sdk.SageMaker({ accessKeyId, secretAccessKey, sessionToken });
    const params = {
      NotebookInstanceName: connection.info,
    };
    const sageMakerResponse = await sagemaker.createPresignedNotebookInstanceUrl(params).promise();
    return sageMakerResponse;
  }

  // Getter for AWS method to make mocking easier in unit tests
  async getAWS() {
    const aws = await this.service('aws');
    return aws;
  }

  async audit(requestContext, auditEvent) {
    const auditWriterService = await this.service('auditWriterService');
    // Calling "writeAndForget" instead of "write" to allow main call to continue without waiting for audit logging
    // and not fail main call if audit writing fails for some reason
    // If the main call also needs to fail in case writing to any audit destination fails then switch to "write" method as follows
    // return auditWriterService.write(requestContext, auditEvent);
    return auditWriterService.writeAndForget(requestContext, auditEvent);
  }

  /**
   * Private utility method to extract public/private ip and dns from given EC2 instance information
   * @param instanceInfo
   */
  toNetworkInterfaces(instanceInfo) {
    const networkInterfaces = _.get(instanceInfo, 'NetworkInterfaces') || [];
    const networkInterfacesTransformed = _.map(networkInterfaces, ni => {
      return {
        publicDnsName: _.get(ni, 'Association.PublicDnsName'),
        publicIp: _.get(ni, 'Association.PublicIp'),
        privateDnsName: _.get(ni, 'PrivateDnsName'),
        privateIp: _.get(ni, 'PrivateIpAddress'),
      };
    });
    return networkInterfacesTransformed;
  }
}

module.exports = EnvironmentScConnectionService;
