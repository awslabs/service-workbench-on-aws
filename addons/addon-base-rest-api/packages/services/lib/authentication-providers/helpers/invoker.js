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

const resolve = require('./resolver').resolve;

function newInvoker(findServiceByName) {
  return async (locator, ...args) => {
    const resolvedLocator = resolve(locator);
    switch (resolvedLocator.type) {
      case 'service': {
        const { serviceName, methodName } = resolvedLocator;
        const instance = await findServiceByName(serviceName);
        if (!instance) {
          throw new Error(`unknown service: ${serviceName}`);
        }
        return instance[methodName].call(instance, ...args);
      }
      default:
        throw new Error(`unsupported locator type: ${resolve.type}`);
    }
  };
}

module.exports = { newInvoker };
