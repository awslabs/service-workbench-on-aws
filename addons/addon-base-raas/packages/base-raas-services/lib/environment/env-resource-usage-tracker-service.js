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

const getResourceCountKey = principal => `resourceCount|${principal}`;

const settingKeys = {
  tableName: 'dbEnvironmentResourceUsages',
};

/**
 * A service to track usage of a specific resource by the specific environment.
 *
 * The service is only used for tracking AWS resources that need cross account provisioning
 * (such as S3 bucket policy update or KMS resource policy updates etc).
 * The service is not used for tracking all AWS resource usages by environments (workspaces)
 */
class EnvResourceUsageTrackerService extends Service {
  constructor() {
    super();
    this.dependency(['dbService', 'auditWriterService']);
  }

  async init() {
    await super.init();
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    this._updater = () => dbService.helper.updater().table(table);
  }

  async addEnvironmentResourceUse(requestContext, { resource, principal, envId }) {
    const updater = this._updater();
    const result = await updater
      .key({ id: resource, type: getResourceCountKey(principal) })
      .add('envIds :envId')
      .values({ ':envId': updater.client.createSet([envId], { validate: true }) })
      .update();

    // Write audit event
    await this.audit(requestContext, { action: 'increment-resource-count', body: { resource, principal, envId } });

    return { ...result, count: 'envIds' in result ? result.envIds.length : 0 };
  }

  async deleteEnvironmentResourceUse(requestContext, { resource, principal, envId }) {
    const updater = this._updater();
    const result = await updater
      .key({ id: resource, type: getResourceCountKey(principal) })
      .delete('envIds :envId')
      .values({ ':envId': updater.client.createSet([envId], { validate: true }) })
      .update();

    // Write audit event
    await this.audit(requestContext, { action: 'decrement-resource-count', body: { resource, principal, envId } });

    if (result) {
      return { ...result, count: 'envIds' in result ? result.envIds.length : 0 };
    }

    // If result is undefined then we can't determine the usage count. Return -1 in that case.
    // This is for backwards compatibility. This can happen when an existing env is being terminated that was created
    // before this EnvResourceUsageTrackerService existed.
    return { count: -1 };
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

module.exports = EnvResourceUsageTrackerService;
