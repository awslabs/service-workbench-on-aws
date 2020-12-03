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

// const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

const extensionPoint = 'study-access-strategy';

class DataSourceRegistrationService extends Service {
  constructor() {
    super();
    this.dependency([
      'auditWriterService',
      'dataSourceAccountService',
      'dataSourceBucketService',
      'studyService',
      'studyPermissionService',
      'pluginRegistryService',
    ]);
  }

  async registerAccount(requestContext, rawAccountEntity) {
    // We delegate to the data source account service
    const [accountService] = await this.service(['dataSourceAccountService']);

    return accountService.register(requestContext, rawAccountEntity);
  }

  async registerBucket(requestContext, accountId, rawBucketEntity) {
    // We delegate most of the work to the DataSourceBuckService including input validation.
    const [accountService, bucketService] = await this.service(['dataSourceAccountService', 'dataSourceBucketService']);
    const accountEntity = await accountService.mustFind(requestContext, { id: accountId });

    return bucketService.register(requestContext, accountEntity, rawBucketEntity);
  }

  async registerStudy(requestContext, accountId, bucketName, rawStudyEntity) {
    const [accountService, bucketService, studyService] = await this.service([
      'dataSourceAccountService',
      'dataSourceBucketService',
      'studyService',
    ]);

    const accountEntity = await accountService.mustFind(requestContext, { id: accountId });
    const bucketEntity = await bucketService.mustFind(requestContext, { accountId, name: bucketName });
    const studyEntity = await studyService.register(requestContext, accountEntity, bucketEntity, rawStudyEntity);

    // We give a chance to the plugins to participate in the logic of registration. This helps us have different
    // study access strategies
    const pluginRegistryService = await this.service('pluginRegistryService');
    const result = await pluginRegistryService.visitPlugins(extensionPoint, 'onStudyRegistration', {
      payload: {
        requestContext,
        container: this.container,
        accountEntity,
        bucketEntity,
        studyEntity,
      },
    });

    // Write audit event
    await this.audit(requestContext, {
      action: 'register-study',
      body: { accountEntity: result.accountEntity, bucketEntity: result.bucketEntity, studyEntity: result.studyEntity },
    });

    return result.studyEntity;
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

module.exports = DataSourceRegistrationService;
