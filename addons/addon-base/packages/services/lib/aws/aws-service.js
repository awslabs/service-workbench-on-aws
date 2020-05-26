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

const Service = require('@aws-ee/base-services-container/lib/service');

const settingKeys = {
  awsRegion: 'awsRegion',
  awsProfile: 'awsProfile',
  useAwsProfile: 'useAwsProfile',
};

class AwsService extends Service {
  async init() {
    this._sdk = require('aws-sdk'); // eslint-disable-line global-require
    if (process.env.IS_OFFLINE || process.env.IS_LOCAL) this.prepareForLocal(this._sdk);
  }

  get sdk() {
    if (!this.initialized)
      throw new Error('You tried to use "AwsService.sdk()" but the service has not been initialized.');
    return this._sdk;
  }

  prepareForLocal(aws) {
    const sslEnabled = true;
    const maxRetries = 3;
    const useProfile = this.settings.optionalBoolean(settingKeys.useAwsProfile, true);

    let profile;
    let region;
    if (process.env.IS_OFFLINE) {
      // For `sls offline`, get profile from environmentOverrides settings
      if (useProfile) {
        profile = this.settings.get(settingKeys.awsProfile);
      }
      region = this.settings.get(settingKeys.awsRegion);
    } else if (process.env.IS_LOCAL) {
      // For `sls invoke local`, serverless should set AWS_PROFILE from provider -> awsProfile setting
      profile = process.env.AWS_PROFILE;
      region = process.env.AWS_REGION || 'us-east-1';
    }

    if (useProfile) {
      // see http://docs.aws.amazon.com/cli/latest/topic/config-vars.html#cli-aws-help-config-vars
      process.env.AWS_PROFILE = profile;
    }
    process.env.AWS_DEFAULT_REGION = region;
    process.env.AWS_REGION = region;

    aws.config.update({
      region,
      sslEnabled,
      maxRetries,
      logger: console,
    });

    if (useProfile) {
      const creds = new aws.SharedIniFileCredentials({ profile });
      process.env.AWS_ACCESS_KEY_ID = creds.accessKeyId;
      process.env.AWS_SECRET_ACCESS_KEY = creds.secretAccessKey;
      if (creds.sessionToken) process.env.AWS_SESSION_TOKEN = creds.sessionToken;
      aws.config.update({
        credentials: creds,
      });
    }
  }
}

module.exports = AwsService;
