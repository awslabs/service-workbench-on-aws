const Service = require('@aws-ee/base-services-container/lib/service');
const LogTransformer = require('./log-transformer');

class LoggerService extends Service {
  constructor(
    logger = console,
    loggingContext = {},
    fieldsToMask = ['x-amz-security-token', 'user', 'accessKey', 'password'],
  ) {
    super();
    this.logger = logger;
    this.logTransformer = new LogTransformer(loggingContext, fieldsToMask);
  }

  info(logPayload, ...args) {
    const transformedLogPayload = this.logTransformer.transformForInfo(logPayload);
    return this.logger.info(transformedLogPayload, ...args);
  }

  log(logPayload, ...args) {
    const transformedLogPayload = this.logTransformer.transformForLog(logPayload);
    return this.logger.log(transformedLogPayload, ...args);
  }

  debug(logPayload, ...args) {
    const transformedLogPayload = this.logTransformer.transformForDebug(logPayload);
    return this.logger.debug(transformedLogPayload, ...args);
  }

  warn(logPayload, ...args) {
    const transformedLogPayload = this.logTransformer.transformForWarn(logPayload);
    return this.logger.warn(transformedLogPayload, ...args);
  }

  error(logPayload, ...args) {
    const transformedLogPayload = this.logTransformer.transformForError(logPayload);
    return this.logger.error(transformedLogPayload, ...args);
  }
}

module.exports = LoggerService;
