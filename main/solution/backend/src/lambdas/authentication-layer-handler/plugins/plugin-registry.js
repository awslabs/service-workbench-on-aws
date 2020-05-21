const baseAuditPlugin = require('@aws-ee/base-services/lib/plugins/audit-plugin');
const baseServicesPlugin = require('@aws-ee/base-authn-handler/lib/plugins/services-plugin');
const bassRaasServicesPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/authn-handler-services-plugin');
const baseRaasUserAuthzPlugin = require('@aws-ee/base-raas-services/lib/user/user-authz-plugin');
const baseRaasAuthnPlugin = require('@aws-ee/base-raas-rest-api/lib/plugins/authentication-plugin');

const servicesPlugin = require('./services-plugin');

const extensionPoints = {
  'service': [baseServicesPlugin, bassRaasServicesPlugin, servicesPlugin],
  'audit': [baseAuditPlugin],
  'user-authz': [baseRaasUserAuthzPlugin],
  'authentication': [baseRaasAuthnPlugin],
};

async function getPlugins(extensionPoint) {
  return extensionPoints[extensionPoint];
}

const registry = {
  getPlugins,
};

module.exports = registry;
