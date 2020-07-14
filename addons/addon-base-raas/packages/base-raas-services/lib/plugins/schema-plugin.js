const createAwsAccounts = require('../schema/create-aws-accounts');
const ensureExternalAwsAccounts = require('../schema/ensure-external-aws-accounts');
const updateAwsAccounts = require('../schema/update-aws-accounts');
const createAccount = require('../schema/create-account');
const updateAccount = require('../schema/update-account');

const schemas = {
  createAwsAccounts,
  ensureExternalAwsAccounts,
  updateAwsAccounts,
  createAccount,
  updateAccount,
};

const getSchema = async (schemaName, currentSchema) => (schemaName in schemas ? schemas[schemaName] : currentSchema);

const plugin = { getSchema };

module.exports = plugin;
