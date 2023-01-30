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
