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
const StepBaseFromWorkflowEngine = require('@aws-ee/workflow-engine/lib/step/step-base');

class StepBase extends StepBaseFromWorkflowEngine {
  constructor({ input, workflowInstance, workflowPayload, stepState, container, step, stepReporter, workflowStatus }) {
    super({ input, workflowInstance, workflowPayload, stepState, step, stepReporter, workflowStatus });
    this.container = container;
  }

  // Do NOT override this method, instead override 'init' if you need to do any initialization of the step
  async initStep() {
    this.settings = await this.mustFindServices('settings');
    return this.init();
  }

  async init() {
    // override this method if needed
    return this;
  }

  // Looks up one or more services by name, if any of them are not found and exception is thrown
  async mustFindServices(oneOrMany) {
    const result = [];
    /* eslint-disable no-restricted-syntax */
    for (const name of _.concat(oneOrMany)) {
      // eslint-disable-line no-restricted-syntax
      const service = await this.container.find(name); // eslint-disable-line no-await-in-loop
      if (!service)
        throw new Error(
          `The step tried to access the "${name}" service, but the "${name}" service was not registered.`,
        );
      result.push(service);
    }
    /* eslint-enable no-restricted-syntax */

    if (!_.isArray(oneOrMany)) return _.head(result);
    return result;
  }

  // Looks up one or more services by name, undefined will be returned for services the are not found
  async optionallyFindServices(oneOrMany) {
    const result = [];
    /* eslint-disable no-restricted-syntax */
    for (const name of _.concat(oneOrMany)) {
      // eslint-disable-line no-restricted-syntax
      const service = await this.container.find(name); // eslint-disable-line no-await-in-loop
      result.push(service);
    }
    /* eslint-enable no-restricted-syntax */

    if (!_.isArray(oneOrMany)) return _.head(result);
    return result;
  }

  // Returns the list of input keys
  // Used by step-reporter
  // returns Object, key - key name, value - key type
  async inputKeys() {
    // TODO: uncomment it when implemented in all steps
    // throw new Error('Input keys method must be implemented');
  }

  // Returns the list of output keys
  // Used by step-reporter
  // returns Object, key - key name, value - key type
  async outputKeys() {
    // TODO: uncomment it when implemented in all steps
    // throw new Error('Input keys method must be implemented');
  }

  // Returns inputs for the step
  async getStepInput() {
    return this.getValues(await this.inputKeys());
  }

  // Returns outputs for the step
  async getStepOutput() {
    return this.getValues(await this.outputKeys());
  }

  // Returns object with values from payloadOrConfig
  // argument - object, key - key name, value - type (string, number, object)
  async getValues(keysMap) {
    const result = {};
    const keys = _.keys(keysMap);
    // eslint-disable-next-line no-restricted-syntax
    for (const key of keys) {
      let value;
      try {
        const type = keysMap[key];
        // eslint-disable-next-line no-await-in-loop
        value = await this.payloadOrConfig[type](key);
      } catch (error) {
        // don't fail here because
        // this is used for logging
        // and value might not be computed yet
      }
      result[key] = value;
    }
    return result;
  }
}

module.exports = StepBase;
