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

const CloudFormation = require('./services/cloudformation.js');
const ParameterStore = require('./services/parameter-store.js');
const DynamoDb = require('./services/dynamodb');
const S3 = require('./services/s3');
const ServiceCatalog = require('./services/service-catalog.js');
const StepFunctions = require('./services/step-functions.js');

/**
 * The function assumes the specified role and constructs an instance of the specified AWS client SDK with the
 * temporary credentials obtained by assuming the role.
 *
 * @param assumeRoleInfo.roleArn The ARN of the role to assume
 * @param assumeRoleInfo.roleSessionName Optional name of the role session (defaults to <envName>-<current epoch time>)
 * @param assumeRoleInfo.externalId Optional external id to use for assuming the role.
 * @param clientName Name of the client SDK to create (E.g., S3, SageMaker, ServiceCatalog etc)
 * @param options Optional options object to pass to the client SDK (E.g., { apiVersion: '2011-06-15' })
 * @returns {Promise<*>}
 */
async function getSdk({ aws, clientName }, options = {}, assumeRoleInfo = {}) {
  if (_.isEmpty(assumeRoleInfo)) {
    return new aws.sdk[clientName](options);
  }
  return aws.getClientSdkForRole({ ...assumeRoleInfo, clientName, options });
}

async function getInstance(ConstructorClass, { aws }, options = {}, assumeRoleInfo = {}) {
  const sdk = await getSdk({ aws, clientName: ConstructorClass.clientName }, options, assumeRoleInfo);
  const instance = new ConstructorClass({ aws, sdk });

  if (_.isFunction(instance.init)) {
    await instance.init();
  }

  return instance;
}

// Returns aws api helpers.
async function getServices({ aws }) {
  // Future: allow components to contribute services via an extension point
  const services = {
    cloudFormation: async (options = {}, roleInfo = {}) => getInstance(CloudFormation, { aws }, options, roleInfo),
    parameterStore: async (options = {}, roleInfo = {}) => getInstance(ParameterStore, { aws }, options, roleInfo),
    dynamoDb: async (options = {}, roleInfo = {}) => getInstance(DynamoDb, { aws }, options, roleInfo),
    s3: async (options = {}, roleInfo = {}) => getInstance(S3, { aws }, options, roleInfo),
    serviceCatalog: async (options = {}, roleInfo = {}) => getInstance(ServiceCatalog, { aws }, options, roleInfo),
    stepFunctions: async (options = {}, roleInfo = {}) => getInstance(StepFunctions, { aws }, options, roleInfo),
  };

  return services;
}

module.exports = { getServices };
