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

const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const querystring = require('querystring');
const request = require('request-promise-native');
const Service = require('@aws-ee/base-services-container/lib/service');

class EnvironmentUrlService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'environmentService', 'environmentDnsService', 'auditWriterService', 'jwtService']);
  }

  async init() {
    await super.init();
  }

  async getEmrUrl(instanceInfo) {
    const authorizedUrl = instanceInfo.JupyterUrl;
    return { AuthorizedUrl: authorizedUrl };
  }

  async getRStudioUrl(id, instanceInfo) {
    const environmentDnsService = await this.service('environmentDnsService');
    const rstudioDomainName = environmentDnsService.getHostname('rstudio', id);
    const rstudioPublicKeyUrl = `https://${rstudioDomainName}/auth-public-key`;
    const rstudioSignInUrl = `https://${rstudioDomainName}/auth-do-sign-in`;
    const instanceId = instanceInfo.Ec2WorkspaceInstanceId;
    const jwtService = await this.service('jwtService');
    const jwtSecret = await jwtService.getSecret();
    const hash = crypto.createHash('sha256');
    const username = 'rstudio-user';
    const password = hash.update(`${instanceId}${jwtSecret}`).digest('hex');
    const credentials = `${username}\n${password}`;
    const publicKey = await request(rstudioPublicKeyUrl);
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
    return { AuthorizedUrl: authorizedUrl };
  }

  async get(requestContext, id) {
    const [environmentService] = await this.service(['environmentService']);
    // The following will succeed only if the user has permissions to access the specified environment
    const environment = await environmentService.mustFind(requestContext, { id });
    const { instanceInfo } = environment;
    let url = '';
    switch (instanceInfo.type) {
      case 'ec2-rstudio':
        url = this.getRStudioUrl(id, instanceInfo);
        break;
      case 'emr':
        url = this.getEmrUrl(instanceInfo);
        break;
      case 'sagemaker':
        url = this.getNotebookPresignedUrl(requestContext, id);
        break;
      default:
        break;
    }

    // Write audit event
    await this.audit(requestContext, { action: 'environment-url-requested', body: { id } });
    return url;
  }

  async getNotebookPresignedUrl(requestContext, id) {
    const [aws, environmentService] = await this.service(['aws', 'environmentService']);

    // The following will succeed only if the user has permissions to access the specified environment
    const { instanceInfo } = await environmentService.mustFind(requestContext, { id });

    const params = {
      NotebookInstanceName: instanceInfo.NotebookInstanceName,
    };
    const sagemaker = new aws.sdk.SageMaker(
      await environmentService.credsForAccountWithEnvironment(requestContext, { id }),
    );
    const url = await sagemaker.createPresignedNotebookInstanceUrl(params).promise();
    url.AuthorizedUrl += '&view=lab';

    // Write audit event
    await this.audit(requestContext, { action: 'notebook-presigned-url-requested', body: { id } });

    return url;
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

module.exports = EnvironmentUrlService;
