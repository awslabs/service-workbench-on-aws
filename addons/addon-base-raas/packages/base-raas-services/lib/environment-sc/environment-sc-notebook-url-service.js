const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

class EnvironmentScNotebookUrlService extends Service {
  constructor() {
    super();
    this.dependency(['environmentScService', 'auditWriterService', 'pluginRegistryService']);
  }

  async init() {
    await super.init();
  }

  async getConnectionUrl(requestContext, id, connectionId) {
    const [environmentScService, pluginRegistryService] = await this.service([
      'environmentScService',
      'pluginRegistryService',
    ]);

    // The following will succeed only if the user has permissions to access the specified environment
    const env = await environmentScService.mustFind(requestContext, { id });
    const connection = _.find(env.connections, { id: connectionId });

    if (_.isEmpty(connection)) {
      throw this.boom.notFound(`The connection with id ${connectionId} was not found`, true);
    }

    // Write audit event
    await this.audit(requestContext, { action: 'notebook-presigned-url-requested', body: { id } });

    if (!_.isEmpty(connection.url)) {
      // if connection already has url then just return it
      return connection;
    }

    if (_.toLower(_.get(connection, 'type', '')) === 'sagemaker') {
      const sagemaker = await environmentScService.getClientSdkWithEnvMgmtRole(
        requestContext,
        { id },
        { clientName: 'SageMaker', options: { apiVersion: '2017-07-24' } },
      );

      const params = {
        NotebookInstanceName: connection.info,
      };
      const sageMakerResponse = await sagemaker.createPresignedNotebookInstanceUrl(params).promise();

      connection.url = _.get(sageMakerResponse, 'AuthorizedUrl');
    }

    const result = await pluginRegistryService.visitPlugins(
      'env-connection-url',
      'getConnectionUrl',
      {
        payload: {
          scEnvironment: env,
          connection,
        },
      },
      { requestContext, container: this.container },
    );

    return _.get(result, 'connection') || connection;
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

module.exports = EnvironmentScNotebookUrlService;
