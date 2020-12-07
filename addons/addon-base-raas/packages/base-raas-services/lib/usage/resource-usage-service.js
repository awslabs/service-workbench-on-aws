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
  tableName: 'dbResourceUsages',
};

/**
 * A service to track usage of a resource/entity consumed by items, grouped by a set name.
 * A set name can be the principal, for example, the member account id. The usage tracking is done using sets.
 * This means that if you add usage of the same resource/entity by the same item using the same set name,
 * more than once, it won't be counted as an additional usage.
 */
class ResourceUsageService extends Service {
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
   * IMPORTANT: If you call this method with the same resource/entity id, setName and item, multiple times, the item
   * is only considered once.
   *
   * The output shape is { resource, setName, items: [<item>, ...], added: true/false }
   * The property 'added' is true if the item was actually added to the set, otherwise, added is false.
   *
   * @param item An item is not an object, it is just a string
   */
  async addUsage(requestContext, { resource, setName, item }) {
    const updater = this._updater();
    const result = await updater
      .key(resourceIdCompositeKey.encode({ resource, setName }))
      .add('#items :item')
      .names({ '#items': 'items' })
      .values({ ':item': updater.client.createSet([item], { validate: true }) })
      .return('ALL_OLD') // We want to get the old set before it was updated, this will help us determine if addition had occurred
      .update();

    // It is possible that there was no entry before the update, in this case, the 'result' variable will be undefined
    const items = _.get(result, 'items', []); // We are getting the old set not the updated set
    const found = _.includes(items, item);
    if (!found) items.push(item);

    const output = { resource, setName, items, added: !found };

    // Write audit event
    await this.audit(requestContext, { action: 'increment-resource-usage', body: output });

    return output;
  }

  /**
   * The output shape is { resource, setName, items: [<item>, ...], removed: true/false }
   * The property 'removed' is true if the item was actually removed from the set, otherwise, removed is false, because
   * the item was previous removed and there is no need to remove it again or the item didn't exist to start with (this
   * could be the case when the new code is deployed while previous workspaces were active).
   *
   * @param item An item is not an object, it is just a string
   */
  async removeUsage(requestContext, { resource, setName, item }) {
    const updater = this._updater();
    const result = await updater
      .key(resourceIdCompositeKey.encode({ resource, setName }))
      .delete('#items :item')
      .names({ '#items': 'items' })
      .values({ ':item': updater.client.createSet([item], { validate: true }) })
      .return('ALL_OLD') // We want to get the old set before it was updated, this will help us determine if removal had occurred
      .update();

    // It is possible that there was no entry before the update, in this case, the 'result' variable will be undefined
    const items = _.get(result, 'items', []); // We are getting the old set not the updated set
    const found = _.includes(items, item);
    if (found) _.remove(items, id => id === item);

    const output = { resource, setName, items, removed: found };

    // Write audit event
    await this.audit(requestContext, { action: 'decrement-resource-count', body: output });

    return output;
  }

  /**
   * Returns all the sets associated with the given resource. If 'setName' is provided (optional), then only
   * this set for the resource is returned.
   *
   * The output shape is { <setName1>: [ <item>, ... ], <setName2>: [ <item>, ... ] }
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
      result[name] = dbEntity.items || [];
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

module.exports = ResourceUsageService;
