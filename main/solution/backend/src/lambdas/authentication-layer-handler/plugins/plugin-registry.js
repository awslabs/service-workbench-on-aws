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

const baseAuditPlugin = require('@aws-ee/base-services/lib/plugins/audit-plugin');
const baseServicesPlugin = require('@aws-ee/base-authn-handler/lib/plugins/services-plugin');
const bassRaasServicesPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/authn-handler-services-plugin');
const baseRaasUserAuthzPlugin = require('@aws-ee/base-raas-services/lib/user/user-authz-plugin');
const baseRaasAuthnPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/authentication-plugin');
const baseRaasSchemaPlugin = require('@aws-ee/base-raas-services/lib/plugins/schema-plugin');

const servicesPlugin = require('services/lib/plugins/services-plugin');

const extensionPoints = {
  'service': [baseServicesPlugin, bassRaasServicesPlugin, servicesPlugin],
  'audit': [baseAuditPlugin],
  'user-authz': [baseRaasUserAuthzPlugin],
  'authentication': [baseRaasAuthnPlugin],

  'schema': [baseRaasSchemaPlugin],
};

async function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint];
}

const registry = {
  getPlugins,
};

module.exports = registry;
