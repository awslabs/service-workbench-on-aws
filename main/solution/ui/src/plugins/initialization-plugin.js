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

/**
 * If you need to add some global UI initialization logic that is specific to the solution, you can do it here. However,
 * It is unlikely that you will need to do so because the base-ui addon takes care of the most common initialization
 * logic needed.
 *
 * @param payload A free form object. Use this object to add any properties that you need to pass to the App model
 * when it is being initialized. The base-ui addon, makes a property named 'tokenInfo' available on this payload object.
 * @param appContext An application context object containing various Mobx Stores, Models etc.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function init(payload, appContext) {
  // Write any solution specific initialization logic.
}

// eslint-disable-next-line no-unused-vars
async function postInit(payload, appContext) {
  // Write any solution specific post initialization logic, such as loading stores.
}

const plugin = {
  init,
  postInit,
};

export default plugin;
