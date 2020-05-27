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

class EventDelegate {
  constructor({ supportedEvents = [], sponsorName = '' } = {}) {
    this.supportedEvents = supportedEvents;
    this.sponsorName = sponsorName;
    this.listenersMap = {}; // key is the event name, value is a list of all listeners
  }

  on(name, fn) {
    const events = this.supportedEvents;
    if (_.indexOf(events, name) === -1) throw new Error(`Event "${name}" is not supported by ${this.sponsorName}.`);
    const entries = this.listenersMap[name] || [];
    entries.push(fn);
    this.listenersMap[name] = entries;

    return this;
  }

  async fireEvent(name, ...params) {
    const listeners = this.listenersMap[name];
    if (_.isEmpty(listeners)) return;
    /* eslint-disable no-restricted-syntax */
    for (const listener of listeners) {
      await listener(...params); // eslint-disable-line no-await-in-loop
    }
    /* eslint-enable no-restricted-syntax */
  }
}

module.exports = EventDelegate;
