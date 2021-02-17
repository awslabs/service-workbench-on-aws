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

const { transform } = require('../../utils/axios-error');

/**
 * A collection resource operations base class. All collection resource operations helpers should extend from
 * this class. This class implements the RESTful "verbs" so that extending classes don't have to do that.
 * The frequency of changes to this class is expected to be minimal.
 */
class CollectionResource {
  constructor({ clientSession, type, childType, childIdProp = 'id', parent }) {
    this.clientSession = clientSession;
    this.axiosClient = clientSession.axiosClient;
    this.setup = clientSession.setup;
    this.settings = this.setup.settings;
    this.type = type;
    this.childType = childType;
    // The name of the id property of the child resource. Most child resources have 'id' as the name of the
    // id property, with a few exceptions such as the User resource where the 'uid' is the name of the
    // id property.
    this.childIdProp = childIdProp;
    this.parent = parent;
  }

  async create(body = {}, params = {}, { api = this.api, applyDefault = true } = {}) {
    try {
      const requestBody = applyDefault ? this.defaults(body) : body;
      const response = await this.axiosClient.post(api, requestBody, { params });
      const resource = response.data;
      const id = _.get(resource, this.childIdProp);
      const taskId = `${this.type}-${id}`;

      // We add a cleanup task to the cleanup queue for the session
      this.clientSession.cleanupQueue.push({ id: taskId, task: async () => this.cleanup(resource) });

      return resource;
    } catch (error) {
      throw transform(error);
    }
  }

  async update(body = {}, params = {}, { api = this.api } = {}) {
    return this.doCall(async () => this.axiosClient.put(api, body, { params }));
  }

  // Because this is a collection resource, the GET method returns an array of the instance child resources
  async get(params = {}, { api = this.api } = {}) {
    return this.doCall(async () => this.axiosClient.get(api, { params }));
  }

  // TODO - delete
  // async delete

  // We wrap the call to axios so that we can capture the boom code and payload attributes passed from the
  // server
  async doCall(fn) {
    try {
      const response = await fn();
      return response.data;
    } catch (error) {
      throw transform(error);
    }
  }

  // Empty implementation of the cleanup task for the child resources. Classes extending the collection
  // resource class should provide their own implementation when appropriate.
  async cleanup(resource) {
    // Empty implementation
    const id = _.get(resource, this.childIdProp);
    console.log(`Resource type [${this.childType}] with id [${id}] has no cleanup logic`);
  }
}

module.exports = CollectionResource;
