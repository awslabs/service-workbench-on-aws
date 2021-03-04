/* eslint-disable dot-notation */
/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
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
const axios = require('axios').default;

const getResources = require('./resources');

/**
 * This class has the following purpose:
 * - The entry point to gain access to the resources abstractions
 * - Represents the principal issuing the API calls
 * - Holds the idToken for the principal
 * - Holds a reference to the configured axios instance
 * - Holds a list of cleanup tasks
 */
class ClientSession {
  constructor({ idToken, setup }) {
    this.anonymous = _.isEmpty(idToken);
    this.setup = setup;
    this.settings = setup.settings;

    // Each element is an object (cleanupTask) of shape { id, command = async fn() }
    this.cleanupQueue = [];

    const headers = { 'Content-Type': 'application/json' };

    // For anonymous sessions, authorization header is not required
    if (!this.anonymous) headers['Authorization'] = idToken;

    this.axiosClient = axios.create({
      baseURL: this.settings.get('apiEndpoint'),
      timeout: 30000, // 30 seconds to mimic API gateway timeout
      headers,
    });
  }

  async init() {
    // In the future, getting the resources might require a registry, so we are keeping this as an async init function
    this.resources = await getResources({ clientSession: this });

    // Load the user associated with this idToken unless it is an anonymous session
    if (this.anonymous) return;

    this.user = await this.resources.currentUser.get();
  }

  async cleanup() {
    // We need to reverse the order of the queue before we execute the cleanup tasks
    const items = _.reverse(_.slice(this.cleanupQueue));

    for (const { task } of items) {
      try {
        await task();
      } catch (error) {
        console.error(error);
      }
    }

    this.cleanupQueue = []; // This way if the cleanup() method is called again, we don't need to cleanup again
  }

  // This is used by the Resource and CollectionResource base classes. You rarely need to use this method unless you
  // want to add your explicit cleanup task
  // @param {object} cleanupTask an object of shape { id, command = async fn() }
  addCleanupTask(cleanupTask) {
    this.cleanupQueue.push(cleanupTask);
  }

  // Given the id of the cleanup task, remove it from the cleanup queue. If there is more than one task with the same
  // id in the queue, all of the tasks with the matching id will be removed.
  // If the method is able to remove the task, the removed task will be returned otherwise undefined is returned
  removeCleanupTask(id) {
    return _.remove(this.cleanupQueue, ['id', id]);
  }
}

async function getClientSession({ idToken, setup }) {
  const session = new ClientSession({ idToken, setup });
  await session.init();
  return session;
}

module.exports = { getClientSession };
