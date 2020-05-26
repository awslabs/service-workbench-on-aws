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

class EnvironmentNotebookUrlService extends Service {
  constructor() {
    super();
    this.dependency(['aws', 'environmentService', 'auditWriterService']);
  }

  async init() {
    await super.init();
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

module.exports = EnvironmentNotebookUrlService;
