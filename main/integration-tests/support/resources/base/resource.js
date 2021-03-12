/* eslint-disable no-console */
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
const { sleep } = require('@aws-ee/base-services/lib/helpers/utils');

const { transform } = require('../../utils/axios-error');

/**
 * A resource operations base class. Resource operations helpers should extend from this class.
 * This class implements the RESTful "verbs" so that extending classes don't have to do that.
 * The frequency of changes to this class is expected to be minimal.
 */
class Resource {
  constructor({ clientSession, type, id, parent }) {
    this.clientSession = clientSession;
    this.axiosClient = clientSession.axiosClient;
    this.setup = clientSession.setup;
    this.settings = this.setup.settings;
    this.type = type;
    this.id = id;
    this.parent = parent;

    // Most child resources have standard api patterns: /api/<parent resource type>/{id}
    // But we can only assume this if both the 'id' and 'parent' are provided. In addition,
    // the extending class can simply choose to construct their own specialized api path
    // and do so in their own constructor functions.
    if (!_.isEmpty(id) && !_.isEmpty(parent)) {
      this.api = `${parent.api}/${id}`;
    }
  }

  // When creating this resource, this method provides default values.
  // Extender should override this method and implement their own logic for providing default values
  defaults(resource = {}) {
    return resource;
  }

  async create(body = {}, params = {}, { api = this.api, applyDefault = true } = {}) {
    try {
      const requestBody = applyDefault ? this.defaults(body) : body;
      const response = await this.axiosClient.post(api, requestBody, { params });
      const resource = response.data;
      const taskId = `${this.type}-${this.id}`;

      // We add a cleanup task to the cleanup queue for the session
      this.clientSession.addCleanupTask({ id: taskId, task: async () => this.cleanup(resource) });

      await sleep(this.deflakeDelay());

      return resource;
    } catch (error) {
      throw transform(error);
    }
  }

  async get(params = {}, { api = this.api } = {}) {
    return this.doCall(async () => this.axiosClient.get(api, { params }));
  }

  async update(body = {}, params = {}, { api = this.api } = {}) {
    const response = await this.doCall(async () => this.axiosClient.put(api, body, { params }));

    await sleep(this.deflakeDelay());
    return response;
  }

  async delete(params = {}, { api = this.api } = {}) {
    return this.doCall(async () => {
      const response = await this.axiosClient.delete(api, { params });

      // Because we explicity deleting the resource, there is no longer a need to run the cleanup
      // task for this resource  (if one existed)
      const taskId = `${this.type}-${this.id}`;
      this.clientSession.removeCleanupTask(taskId);

      await sleep(this.deflakeDelay());
      return response;
    });
  }

  // We wrap the call to axios so that we can capture the boom code and payload attributes passed from the
  // server
  async doCall(fn) {
    try {
      const response = await fn();
      return _.get(response, 'data');
    } catch (error) {
      throw transform(error);
    }
  }

  // This method has the default implementation of the cleanup task for the resource.
  // Classes extending the resource node class can choose to override this method and
  // provide their own implementation but only when appropriate.
  async cleanup() {
    // The cleanup logic is as follows:
    // - We first try to delete the resource using the delete() method
    // - However, it is possible that the user that created the resource does not have permission
    //   to delete the resource or the user might have become inactive. Because of this we will
    //   also try to perform the same delete() method but with default admin credentials

    try {
      await this.delete();
    } catch (error) {
      // Now we try with default admin credentials
      const adminSession = await this.setup.defaultAdminSession();
      this.axiosClient = adminSession.axiosClient;
      await this.delete();
    }
  }

  // Specifies the delay duration in milliseconds needed to minimize the usage of stale data due to eventual
  // consistency. Duration can be altered by overriding function in sub-class.
  async deflakeDelay() {
    return 2000;
  }
}

module.exports = Resource;
