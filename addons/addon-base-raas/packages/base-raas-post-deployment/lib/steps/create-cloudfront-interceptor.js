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
const Service = require('@aws-ee/base-services-container/lib/service');

/**
 * Post-deployment step implementation that configures one or many CloudFront interceptors
 * (Lambda@Edge functions) on the given CloudFront Distribution.
 */
class CreateCloudFrontInterceptor extends Service {
  constructor() {
    super();
    this.dependency(['aws']);
  }

  async init() {
    await super.init();

    this.aws = await this.service('aws');
    this.cloudFrontApi = new this.aws.sdk.CloudFront({ apiVersion: '2019-03-26' });
    this.cloudFrontId = this.settings.get('cloudFrontId');
    this.cloudFrontConfig = await this.cloudFrontApi.getDistributionConfig({ Id: this.cloudFrontId }).promise();
    // CloudFront Lambda@Edge currently only supports Lambda functions created in us-east-1
    this.lambdaApi = new this.aws.sdk.Lambda({ apiVersion: '2015-03-31', region: 'us-east-1' });
  }

  async execute() {
    // TODO: @aws-ee/base-serverless-settings-helper needs to support
    // updating stringified JSON object Serverless settings when resolving
    // crossRegionCloudFormation, so that we don't have to build this object here
    const edgeLambdaConfigs = [
      { lambdaArn: this.settings.get('securityEdgeLambdaArn'), behavior: 'default', eventType: 'origin-response' },
      { lambdaArn: this.settings.get('securityEdgeLambdaArn'), behavior: 'docs/*', eventType: 'origin-response' },
      { lambdaArn: this.settings.get('redirectsEdgeLambdaArn'), behavior: 'docs/*', eventType: 'origin-request' },
    ];

    let didPublishLambdaVersion;
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const [i, { lambdaArn, behavior, eventType }] of edgeLambdaConfigs.entries()) {
      this.log.info(
        `Processing Lambda@Edge function (${i + 1}/${
          edgeLambdaConfigs.length
        }) with ARN "${lambdaArn}" and EventType "${eventType}"`,
      );
      const shouldPublish = await this.shouldPublishLambdaVersion(lambdaArn, behavior);
      if (shouldPublish) {
        await this.publishNewLambdaVersion(lambdaArn);
        didPublishLambdaVersion = true;
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */

    if (!didPublishLambdaVersion) {
      this.log.info(
        `Skipping updating CloudFront Distribution "${this.cloudFrontId}" as no new Lambda versions were published`,
      );
      return;
    }
    await this.associateLambdasWithDistribution(edgeLambdaConfigs);
  }

  async shouldPublishLambdaVersion(lambdaArn, behavior) {
    /*
     * Pseudo Code:
     * -- Get existing Lambda@Edge function version ARN configured on CloudFront
     * -- Determine new Lambda@Edge function version should be published if:
     *    -- No Lambda@Edge function with the given ARN is configured on CloudFront
     *    -- Lambda@Edge function version is configured on CloudFront and CodeSha256      *       for that version is different from what is configured
     *
     * Note: We need to publish Lambda Version using Lambda SDK here instead of simply using "AWS::Lambda::Version"
     * CloudFormation resource in the "edge-lambda" stack to publish Lambda. That's because the "AWS::Lambda::Version"
     * will end up publishing new version of the Lambda function every time. We want to publish only if the lambda@edge
     * code has changed.
     */
    // -- Get existing Lambda@Edge function version ARN configured on CloudFront
    const existingLambdaAssociations = _.get(
      this.cloudFrontConfig,
      behavior === 'default'
        ? 'DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Items'
        : `DistributionConfig.CacheBehaviors.Items[${this.cloudFrontConfig.DistributionConfig.CacheBehaviors.Items.findIndex(
            cb => cb.PathPattern === behavior,
          )}].LambdaFunctionAssociations.Items`,
    );
    let existingVersionedArn;
    existingLambdaAssociations.forEach(association => {
      // Remove version ARN suffix to compare to `lambdaArn`
      const existingArn = association.LambdaFunctionARN.substring(0, association.LambdaFunctionARN.lastIndexOf(':'));
      if (existingArn === lambdaArn) {
        existingVersionedArn = association.LambdaFunctionARN;
      }
    });

    if (!existingVersionedArn) {
      this.log.info(
        `Publishing new version of Lambda with ARN "${lambdaArn}" because no function with this ARN is yet configured for behavior "${behavior}" of CloudFront Distribution "${this.cloudFrontId}".`,
      );
      return true;
    }

    // -- If a Lambda@Edge function version is configured on CloudFront then get CodeSha256 for that version
    const existingSha256 = existingVersionedArn && (await this.getLambdaCodeSha256(existingVersionedArn));
    // -- Get latest CodeSha256 value for the Lambda (assumes latest version by default)
    const latestSha256 = await this.getLambdaCodeSha256(lambdaArn);

    if (existingSha256 === latestSha256) {
      this.log.info(
        `Skipping publishing new version of Lambda with ARN "${lambdaArn}" because behavior "${behavior}" of CloudFront distribution "${this.cloudFrontId}" is already configured with a version of the function with the same code.`,
      );
      return false;
    }

    this.log.info(
      `Publishing new version of Lambda with ARN "${lambdaArn}" because the existing version "${existingVersionedArn}" associated with behavior "${behavior}" of CloudFront distribution "${this.cloudFrontId}" has different code.`,
    );
    return true;
  }

  async getLambdaCodeSha256(lambdaArn) {
    const lambdaInfo = await this.lambdaApi.getFunction({ FunctionName: lambdaArn }).promise();

    return lambdaInfo.Configuration.CodeSha256;
  }

  async publishNewLambdaVersion(lambdaArn) {
    this.log.info(`Publishing new version of function with ARN "${lambdaArn}"`);
    const lambdaInfo = await this.lambdaApi.publishVersion({ FunctionName: lambdaArn }).promise();

    const publishedArn = lambdaInfo.FunctionArn;
    this.log.info(`Published versioned Lambda ARN is "${publishedArn}"`);
    return publishedArn;
  }

  async associateLambdasWithDistribution(edgeLambdaConfigs) {
    this.log.info(`Associating latest Lambda@Edge functions with CloudFront Distribution "${this.cloudFrontId}"`);

    // Prepare updateDistribution parameters
    // 1. Set cloudFrontID
    // 2. Set IfMatch to the value of ETag
    // 3. Remove ETag
    // See "https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#updateDistribution-property" for details
    const newCloudFrontConfig = {
      ...this.cloudFrontConfig,
      Id: this.cloudFrontId,
      IfMatch: this.cloudFrontConfig.ETag,
    };
    delete newCloudFrontConfig.ETag;

    // 4. Add Lambda@Edge function ARNs and EventTypes per cache behavior

    // -- Group by cache behavior
    const groupedConfigs = _.groupBy(edgeLambdaConfigs, config => config.behavior);
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const [behavior, configs] of Object.entries(groupedConfigs)) {
      let pathToUpdate;
      if (behavior === 'default') {
        pathToUpdate = 'DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations';
      } else {
        pathToUpdate = `DistributionConfig.CacheBehaviors.Items[${newCloudFrontConfig.DistributionConfig.CacheBehaviors.Items.findIndex(
          cb => cb.PathPattern === behavior,
        )}].LambdaFunctionAssociations`;
      }

      _.set(newCloudFrontConfig, pathToUpdate, {
        Quantity: configs.length, // The number of Lambda function associations for this cache behavior. This needs to be same as Items.length
        Items: await Promise.all(
          configs.map(async config => {
            const latestVersionNum = await this.getLatestLambdaVersionNum(config.lambdaArn);
            return {
              LambdaFunctionARN: `${config.lambdaArn}:${latestVersionNum}`,
              EventType: config.eventType,
            };
          }),
        ),
      });
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */

    return this.cloudFrontApi.updateDistribution(newCloudFrontConfig).promise();
  }

  async getLatestLambdaVersionNum(lambdaArn) {
    const lambdaInfo = await this.lambdaApi.listVersionsByFunction({ FunctionName: lambdaArn }).promise();

    let maxVersionNum = 1;
    lambdaInfo.Versions.forEach(version => {
      const versionNum = Number(version.Version);
      if (!Number.isNaN(versionNum) && versionNum > maxVersionNum) {
        maxVersionNum = versionNum;
      }
    });

    return maxVersionNum;
  }
}

module.exports = CreateCloudFrontInterceptor;
