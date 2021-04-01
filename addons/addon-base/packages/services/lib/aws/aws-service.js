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

/* eslint-disable global-require */

const _ = require('lodash');
const Service = require('@aws-ee/base-services-container/lib/service');

const { retry } = require('../helpers/utils');

const settingKeys = {
  awsRegion: 'awsRegion',
  awsProfile: 'awsProfile',
  useAwsProfile: 'useAwsProfile',
  localRoleArn: 'localRoleArn',
  localRoleAutoAdjustTrust: 'localRoleAutoAdjustTrust',
  envName: 'envName',
};

class AwsService extends Service {
  async init() {
    await super.init();

    this._sdk = require('aws-sdk');
    if (!process.env.IS_OFFLINE) {
      const AWSXRay = require('aws-xray-sdk');
      this._sdk = AWSXRay.captureAWS(require('aws-sdk'));
    }

    // It's possible to get throttling errors during heavy load due to the rate limit of aws apis calls,
    // so slow down and try more often in an attempt to recover from these errors.
    // Make sure to use regional endpoints for STS. Global STS endpoints are deprecated.
    this._sdk.config.update({ stsRegionalEndpoints: 'regional', maxRetries: 6, retryDelayOptions: { base: 1000 } });
    if (process.env.IS_OFFLINE || process.env.IS_LOCAL) {
      await this.prepareForLocal(this._sdk);
    }
  }

  get sdk() {
    if (!this.initialized)
      throw new Error('You tried to use "AwsService.sdk()" but the service has not been initialized.');
    return this._sdk;
  }

  /**
   * Method assumes the specified role and constructs an instance of the
   * specified AWS client SDK with the temporary credentials obtained by
   * assuming the role.
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
   * Method assumes the specified role and returns the temporary credentials obtained by
   * assuming the role.
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

  async prepareForLocal(aws) {
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

    await this.prepareWithLocalRoleCreds(aws);
  }

  async prepareWithLocalRoleCreds(aws) {
    // If localRoleArn setting is specified then assume that role and initialize AWS sdk with resulting credentials
    // This is useful when testing code locally and running it under specific permissions provided by some role
    // For example, running Lambda code locally under the same Lambda execution role that the function would run in
    // deployed environment
    const localRoleArn = this.settings.optional(settingKeys.localRoleArn, '');
    if (!localRoleArn) return;

    this.log.log(`Initializing AWS Credentials by assuming ${localRoleArn}`);

    const sts = new aws.STS({ apiVersion: '2011-06-15' });
    let creds;
    try {
      creds = await this.assumeLocalRole(aws, localRoleArn);
    } catch (e) {
      // Error assuming the specified role for local execution.
      // This is most likely due the role not having trust policy to allow us to assume it

      // Check if the flag for auto adjusting the trust policy is set
      const { Arn: callerArn } = await sts.getCallerIdentity().promise();
      const autoAdjustTrustPolicy = this.settings.optionalBoolean(settingKeys.localRoleAutoAdjustTrust, false);
      if (!autoAdjustTrustPolicy) {
        throw this.boom
          .internalError(
            `Error assuming role "${localRoleArn}". Make sure the role's trust policy allows "${callerArn}" to assume the role.
           To auto adjust the role's trust policy, set '${settingKeys.localRoleAutoAdjustTrust}' setting to true and try again.`,
            true,
          )
          .cause(e);
      }

      // Code reached here means, we need to adjust the trust policy of the role
      this.log.log(
        `${settingKeys.localRoleAutoAdjustTrust} is true so adjusting the role trust policy in role '${localRoleArn}'`,
      );
      const iam = new aws.IAM({ apiVersion: '2010-05-08' });
      const roleName = _.split(localRoleArn, '/')[1];
      const role = await iam
        .getRole({
          RoleName: roleName,
        })
        .promise();

      // Get existing trust policy
      // The "AssumeRolePolicyDocument" is URL encoded JSON string
      const trustPolicy = JSON.parse(decodeURIComponent(_.get(role, 'Role.AssumeRolePolicyDocument')));
      const statements = _.get(trustPolicy, 'Statement', []);
      const statementToAllowAssumeRole = _.find(statements, s => _.get(s, 'Action') === 'sts:AssumeRole');

      // Update trust policy to allow AssumeRole by the caller
      let allowedPrincipal = _.get(statementToAllowAssumeRole, 'Principal.AWS', []);
      if (_.isArray(allowedPrincipal)) {
        allowedPrincipal.push(callerArn);
      } else {
        allowedPrincipal = [allowedPrincipal, callerArn];
      }
      _.set(statementToAllowAssumeRole, 'Principal.AWS', _.uniq(allowedPrincipal));
      this.log.log({
        msg: `Updating '${roleName}' to allow to assumeRole by '${callerArn}'`,
        trustPolicy,
      });
      try {
        await iam.updateAssumeRolePolicy({ PolicyDocument: JSON.stringify(trustPolicy), RoleName: roleName }).promise();
      } catch (err) {
        throw this.boom.internalError(`Error updating assume role policy for role "${roleName}"`).cause(err);
      }

      // Try to assume the role again after adjusting trust policy
      // IAM policy changes propagation may take some time so wrap with "retry" to retry
      // with exponential backoff
      try {
        creds = await retry(() => this.assumeLocalRole(aws, localRoleArn), 5);
      } catch (err) {
        // many times due to IAM propagation delay the assume role call fails even after retries with backoff
        // in that case just ask the user to try again, as this is ONLY for local development
        throw this.boom
          .internalError(
            `Error assuming role "${localRoleArn}" even after adjusting the role's trust policy. This is most likely IAM propagation timing issue. Please try to run the lambda again.`,
          )
          .cause(err);
      }
    }

    const { AccessKeyId: accessKeyId, SecretAccessKey: secretAccessKey, SessionToken: sessionToken } = creds;
    process.env.AWS_ACCESS_KEY_ID = accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    process.env.AWS_SESSION_TOKEN = sessionToken;
    aws.config.update({ credentials: { accessKeyId, secretAccessKey, sessionToken } });

    const { Arn: roleSessionArn } = await new aws.STS({ apiVersion: '2011-06-15' }).getCallerIdentity().promise();
    this.log.log(`Successfully switched to '${localRoleArn}': Role Session ARN = '${roleSessionArn}'`);
  }

  async assumeLocalRole(aws, localRoleArn) {
    const sts = new aws.STS({ apiVersion: '2011-06-15' });
    const envName = this.settings.get(settingKeys.envName);
    const { Credentials: creds } = await sts
      .assumeRole({
        RoleArn: localRoleArn,
        RoleSessionName: `${envName}-local-dev`,
      })
      .promise();
    return creds;
  }
}

module.exports = AwsService;
