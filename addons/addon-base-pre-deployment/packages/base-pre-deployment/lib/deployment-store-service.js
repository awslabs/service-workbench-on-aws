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
const { runAndCatch } = require('@aws-ee/base-services/lib/helpers/utils');

const createOrUpdateSchema = require('./schema/deployment-item.json');

const settingKeys = {
  tableName: 'dbDeploymentStore',
};

class DeploymentStoreService extends Service {
  constructor() {
    super();
    this.dependency(['jsonSchemaValidationService', 'dbService']);
  }

  async init() {
    await super.init();
    const [dbService] = await this.service(['dbService']);
    const table = this.settings.get(settingKeys.tableName);

    this._getter = () => dbService.helper.getter().table(table);
    this._updater = () => dbService.helper.updater().table(table);
    this._query = () => dbService.helper.query().table(table);
    this._deleter = () => dbService.helper.deleter().table(table);
  }

  async find({ type, id, fields = [] }) {
    return this._getter()
      .key({ type, id })
      .projection(fields)
      .get();
  }

  async mustFind({ type, id, fields = [] }) {
    const result = await this.find({ type, id, fields });
    if (!result) throw this.boom.notFound(`deployment item of type "${type}" and id "${id}" does not exist`, true);
    return result;
  }

  async createOrUpdate(rawData) {
    const [validationService] = await this.service(['jsonSchemaValidationService']);

    // Validate input
    await validationService.ensureValid(rawData, createOrUpdateSchema);

    const { type, id } = rawData;

    // Time to save the the db object
    return this._updater()
      .key({ type, id })
      .item(rawData)
      .update();
  }

  async delete({ type, id }) {
    // Lets now remove the item from the database
    const result = await runAndCatch(
      async () => {
        return this._deleter()
          .condition('attribute_exists(type) and attribute_exists(id)') // yes we need this
          .key({ type, id })
          .delete();
      },
      async () => {
        throw this.boom.notFound(`deployment item of type "${type}" and id "${id}" does not exist`, true);
      },
    );

    return result;
  }
}

module.exports = DeploymentStoreService;
