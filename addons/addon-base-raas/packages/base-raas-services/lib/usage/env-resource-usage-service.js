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
const Service = require('@aws-ee/base-services-container/lib/service');

const { resourceIdCompositeKey } = require('./helpers/composite-keys');

const settingKeys = {
  tableName: 'dbEnvResourceUsages',
};

/**
 * A service to track usage of a resource/entity given an environment, grouped by a set name.
 * A set name can be the principal, for example, the member account id. The usage tracking is done using sets.
 * This means that if you add the same resource/entity for the same environment using the same set name,
 * more than once, it won't be counted as an additional usage.
 *
 * The service is not meant to be used for general tracking of all AWS resource usages by environments (workspaces)
 */
class EnvResourceUsageService extends Service {
  constructor() {
    super();
    this.dependency(['dbService', 'auditWriterService']);
  }

  async init() {
    await super.init();
    const dbService = await this.service('dbService');
    const table = this.settings.get(settingKeys.tableName);

    this._query = () => dbService.helper.query().table(table);
    this._updater = () => dbService.helper.updater().table(table);
  }

  /**
   * IMPORTANT: If you call this method with the same resource/entity id, setName and envId, multiple times, the envId
   * is only added once.
   *
   * The output shape is { resource, setName, envIds: [<envId>, ...], added: true/false }
   * The property 'added' is true if the envId was actually added to the set, otherwise, added is false.
   */
  async addEnvironment(requestContext, { resource, setName, envId }) {
    const updater = this._updater();
    const result = await updater
      .key(resourceIdCompositeKey.encode({ resource, setName }))
      .add('envIds :envId')
      .values({ ':envId': updater.client.createSet([envId], { validate: true }) })
      .return('ALL_OLD') // We want to get the old set before it was updated, this will help us determine if addition had occurred
      .update();

    // It is possible that there was no entry before the update, in this case, the 'result' variable will be undefined
    const envIds = _.get(result, 'envIds', []); // We are getting the old set not the updated set
    const found = _.includes(envIds, envId);
    if (!found) envIds.push(envId);

    const output = { resource, setName, envIds, added: !found };

    // Write audit event
    await this.audit(requestContext, { action: 'increment-resource-count', body: output });

    return output;
  }

  /**
   * The output shape is { resource, setName, envIds: [<envId>, ...], removed: true/false }
   * The property 'removed' is true if the envId was actually removed from the set, otherwise, removed is false, because
   * the envId was previous removed and there is no need to remove it again or the envId didn't exist to start with (this
   * could be the case when the new code is deployed while previous workspaces were active).
   */
  async removeEnvironment(requestContext, { resource, setName, envId }) {
    const updater = this._updater();
    const result = await updater
      .key(resourceIdCompositeKey.encode({ resource, setName }))
      .delete('envIds :envId')
      .values({ ':envId': updater.client.createSet([envId], { validate: true }) })
      .return('ALL_OLD') // We want to get the old set before it was updated, this will help us determine if removal had occurred
      .update();

    // It is possible that there was no entry before the update, in this case, the 'result' variable will be undefined
    const envIds = _.get(result, 'envIds', []); // We are getting the old set not the updated set
    const found = _.includes(envIds, envId);
    if (found) _.remove(envIds, id => id === envId);

    const output = { resource, setName, envIds, removed: found };

    // Write audit event
    await this.audit(requestContext, { action: 'decrement-resource-count', body: output });

    return output;
  }

  /**
   * Returns all the sets associated with the given resource. If 'setName' is provided (optional), then only
   * this set for the resource is returned.
   *
   * The output shape is { <setName1>: [ <envId>, ... ], <setName2>: [ <envId>, ... ] }
   */
  async getResourceUsage(requestContext, { resource, setName }) {
    let op = this._query().key('pk', resourceIdCompositeKey.pk(resource));

    if (!_.isEmpty(setName)) {
      op = op.sortKey('sk').eq(resourceIdCompositeKey.sk(setName));
    }

    const dbEntities = await op.limit(1000).query();
    const result = {};

    _.forEach(dbEntities, dbEntity => {
      const { setName: name } = resourceIdCompositeKey.decode(dbEntity);
      result[name] = dbEntity.envIds || [];
    });

    return result;
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

module.exports = EnvResourceUsageService;
