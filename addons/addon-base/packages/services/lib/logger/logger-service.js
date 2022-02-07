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
const LogTransformer = require('./log-transformer');

class LoggerService extends Service {
  constructor(logger = console, loggingContext = {}, fieldsToMask = ['x-amz-security-token', 'accessKey', 'password']) {
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
