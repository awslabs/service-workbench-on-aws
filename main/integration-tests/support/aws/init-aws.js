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

const sdk = require('aws-sdk');

const Settings = require('../utils/settings');
const { initConfig } = require('./config');
const { getServices } = require('./services');

const settingKeys = {
  isBuildServer: 'isBuildServer',
  awsRegion: 'awsRegion',
  awsProfile: 'awsProfile',
  envName: 'envName',
};

class AwsService {
  constructor({ settings }) {
    this.settings = settings;
    this.region = settings.get(settingKeys.awsRegion);
    this.sdk = sdk;
  }

  async init() {
    // It's possible to get throttling errors during heavy load due to the rate limit of aws apis calls,
    // so slow down and try more often in an attempt to recover from these errors.
    // Make sure to use regional endpoints for STS. Global STS endpoints are deprecated.
    this.sdk.config.update({
      sslEnabled: true,
      region: this.region,
      stsRegionalEndpoints: 'regional',
      maxRetries: 6,
      retryDelayOptions: { base: 1000 },
    });

    const isBuildServer = this.settings.get(settingKeys.isBuildServer);
    if (!isBuildServer) {
      await this.configureSdk();
    }

    this.services = await getServices({ aws: this });
  }

  // When we are not running in the build server, we need to configure sdk to match the aws profile selected
  // in the settings
  async configureSdk() {
    const profile = this.settings.get(settingKeys.awsProfile);
    const region = this.region;
    const credentials = new this.sdk.SharedIniFileCredentials({ profile });

    // We need to inject environment variables to the process so that the aws sdk will function
    process.env.AWS_PROFILE = profile;
    process.env.AWS_DEFAULT_REGION = region;
    process.env.AWS_REGION = region;
    process.env.AWS_ACCESS_KEY_ID = credentials.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = credentials.secretAccessKey;
    if (credentials.sessionToken) process.env.AWS_SESSION_TOKEN = credentials.sessionToken;

    this.sdk.config.update({
      credentials,
    });
  }

  /**
   * Method assumes the specified role and constructs an instance of the specified AWS client SDK with the temporary
   * credentials obtained by assuming the role. Usually, there is no need to call this directly from your code as
   * many of the services classes take care of that for you.
   *
   * @param roleArn The ARN of the role to assume
   * @param roleSessionName Optional name of the role session (defaults to <envName>-<current epoch time>)
   * @param externalId Optional external id to use for assuming the role.
   * @param clientName Name of the client SDK to create (E.g., S3, SageMaker, ServiceCatalog etc)
   * @param options Optional options object to pass to the client SDK (E.g., { apiVersion: '2011-06-15' })
   * @returns {Promise<*>}
   */
  async getClientSdkForRole({ roleArn, roleSessionName, externalId, clientName, options = {} } = {}) {
    const opts = {
      ...options,
      credentials: await this.getCredentialsForRole({ roleArn, roleSessionName, externalId }),
    };
    return new this.sdk[clientName](opts);
  }

  /**
   * Method assumes the specified role and returns the temporary credentials obtained by assuming the role.
   * Usually, there is no need to call this directly from your code as many of the services classes take
   * care of that for you.
   *
   * @param roleArn The ARN of the role to assume
   * @param roleSessionName Optional name of the role session (defaults to <envName>-<current epoch time>)
   * @param externalId Optional external id to use for assuming the role.
   * @returns {Promise<{accessKeyId, secretAccessKey, sessionToken}>}
   */
  async getCredentialsForRole({ roleArn, roleSessionName, externalId }) {
    const sts = new this.sdk.STS({ apiVersion: '2011-06-15' });
    const envName = this.settings.get(settingKeys.envName);
    const params = {
      RoleArn: roleArn,
      RoleSessionName: roleSessionName || `${envName}-${Date.now()}`,
    };
    if (externalId) {
      params.ExternalId = externalId;
    }
    const { Credentials: creds } = await sts.assumeRole(params).promise();

    const { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken } = creds;
    return { accessKeyId, secretAccessKey, sessionToken };
  }
}

async function initAws({ settings }) {
  const aws = new AwsService({ settings });
  const awsConfig = await initConfig({ settings });
  // The settings store that we will make available under 'aws' should contain both the settings from the test
  // configuration and the settings collected from config.js
  const config = { ...settings.entries, ...awsConfig };

  aws.settings = new Settings(config, { sourceText: 'support/aws.config.js file' });
  await aws.init();

  return aws;
}

module.exports = { initAws };
