/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/apache2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

const AppStreamScEnvConfigVarsService = require('@aws-ee/base-raas-appstream-services/lib/appstream/appstream-sc-env-config-vars-service');
const AppStreamScService = require('@aws-ee/base-raas-appstream-services/lib/appstream/appstream-sc-service');

/**
 * Registers the services needed by the workflow loop runner lambda function
 * @param container An instance of ServicesContainer to register services to
 * @param pluginRegistry A registry that provides plugins registered by various addons for the specified extension point.
 *
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
async function registerServices(container, _pluginRegistry) {
  container.register('appStreamScEnvConfigVarsService', new AppStreamScEnvConfigVarsService());
  container.register('appStreamScService', new AppStreamScService());
}

const plugin = {
  registerServices,
};

module.exports = plugin;
