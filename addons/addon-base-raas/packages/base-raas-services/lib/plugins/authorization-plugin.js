const authorizationPluginFactory = require('@aws-ee/base-services/lib/authorization/authorization-plugin-factory');

module.exports = authorizationPluginFactory('addon/raas/authorizers');
