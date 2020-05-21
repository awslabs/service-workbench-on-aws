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
