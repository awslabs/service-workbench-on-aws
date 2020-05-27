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

const KeyGetterDelegate = require('./helpers/key-getter-delegate');
const StepPayload = require('./step/step-payload');

class WorkflowPayload {
  constructor({ input, meta, workflowInstance }) {
    this.input = input;
    this.workflowInstance = workflowInstance;
    this.store = []; // [ StepPayload ]
    this.meta = meta;
    this.loaded = false;

    // lets build empty StepPayload objects using the information we have about the steps
    _.forEach(workflowInstance.steps, step => {
      this.store.push(new StepPayload({ step, workflowInstance }));
    });

    const getterDelegate = new KeyGetterDelegate(async key => this.getValue(key), {
      loadFn: async key => this.load(key),
      storeTitle: 'Workflow payload',
    });
    Object.assign(this, getterDelegate.getMethods());
  }

  // The memento shape is:
  // {
  //   "s": [ step payload memento, ...] // "s" = store memento,
  // }

  setMemento({ s = [], m = {} } = {}) {
    // IMPORTANT and DANGEROUS assumption:
    // - We assume that the array of the "s" memento has the same step orders, which is a valid assumption
    //   unless we introduce a new feature in which the order of the steps changes after
    //   a tick() (this is unlikely a good feature, anyway)
    _.forEach(s, (stepPayloadMemento, index) => {
      if (index >= this.store.length)
        throw new Error('The number of step payloads in the workflow is not the same as the last tick');
      this.store[index].setMemento(stepPayloadMemento);
    });
    this.meta = m;
    return this;
  }

  getMemento() {
    return {
      s: _.map(this.store, stepPayload => stepPayload.getMemento()),
      m: this.meta || {},
    };
  }

  get dirty() {
    return !_.isEmpty(_.find(this.store, ['dirty', true]));
  }

  // NOTE: all of the following methods are coming from getterDelegate.getMethods()
  // async string(key)
  // async number(key)
  // async boolean(key)
  // async object(key)
  // async optionalString(key, defaults)
  // async optionalNumber(key, defaults)
  // async optionalBoolean(key, defaults)
  // async optionalObject(key, defaults)

  async load() {
    // Since the store is kept in the memento (for now), there is no need
    // to load the store from anywhere else
    if (this.loaded) return;
    this.loaded = true;
  }

  async save() {
    // Since the store is kept in the memento (for now), there is no need
    // to save the store to anywhere else
    if (!this.dirty) return;

    // Currently, we are looping through each StepPayload and ask it to save itself,
    // this does not do anything for now and the main reason we are doing this is to ensure
    // that the StepPayload dirty flag is dealt with correctly
    /* eslint-disable no-restricted-syntax */
    for (const stepPayload of this.store) {
      await stepPayload.save(); // eslint-disable-line no-await-in-loop
    }
    /* eslint-enable no-restricted-syntax */
  }

  // The search is in reverse order, the last step wins while the workflow input is the first to search.
  // This allows steps to override previous steps keys
  async getValue(key) {
    const stores = this.searchableStores();
    const size = stores.length;
    let value;
    let index = 0;

    while (index < size && _.isUndefined(value)) {
      const stepPayload = stores[index];
      value = await stepPayload.getValue(key); // eslint-disable-line no-await-in-loop
      index += 1;
    }

    return value;
  }

  async getStepPayload({ stpIndex } = {}) {
    if (_.isNil(stpIndex) || stpIndex < 0)
      throw new Error('You are trying to get the step payload but provided incorrect/missing step information');
    if (stpIndex >= this.store.length) throw new Error(`No step payload is found for step index "${stpIndex}"`);

    return this.store[stpIndex];
  }

  // Allow for the removal of a key from all steps payloads
  async removeKey(key) {
    /* eslint-disable no-restricted-syntax */
    for (const stepPayload of this.store) {
      await stepPayload.removeKey(key); // eslint-disable-line no-await-in-loop
    }
    /* eslint-enable no-restricted-syntax */
  }

  // Allow for the removal of all keys from all steps payloads
  async removeAllKeys() {
    /* eslint-disable no-restricted-syntax */
    for (const stepPayload of this.store) {
      await stepPayload.removeAllKeys(); // eslint-disable-line no-await-in-loop
    }
    /* eslint-enable no-restricted-syntax */
  }

  /**
   * Returns an array of all keys that are available from the workflow payload so far
   * @returns {Promise<Array>}
   */
  async allKeys() {
    // Explanation:
    // The "this.searchableStores()" below is an array of stores containing instances of StepPayload and WorkflowInput
    //
    // The "_.map(this.store, async store => store.allKeys())" below returns an array of promises where each
    // promise maps to the keys from the corresponding StepPayload.
    //
    // The "await Promise.all(_.map(this.store, async store => store.allKeys())))" below awaits these promises to be
    // resolved and since each of these promises are resolving to array of keys the resulting array will be array of
    // arrays containing keys from all stores
    //
    // The _.flatten flattens them into a single array
    // The _.uniq de-duplicates keys
    const allSearchableStores = this.searchableStores();
    return _.uniq(_.flatten(await Promise.all(_.map(allSearchableStores, async store => store.allKeys()))));
  }

  /**
   * Returns a plain JavaScript object containing all key/value accumulated in the workflow payload so far
   * @returns {Promise<[unknown]>}
   */
  async toPayloadContent() {
    const allKeys = await this.allKeys();
    const payloadContent = {};
    await Promise.all(
      _.map(allKeys, async key => {
        payloadContent[key] = await this.getValue(key);
      }),
    );
    return payloadContent;
  }

  // private
  // The search is in reverse order, the last step wins while the workflow input is the first to search.
  // This allows steps to override previous steps keys
  searchableStores() {
    const stores = _.reverse(this.store.slice());
    stores.push(this.input);

    return stores;
  }
}

module.exports = WorkflowPayload;
