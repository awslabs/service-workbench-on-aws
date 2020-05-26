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
 * Post deployment step implementation that configures cloudFront interceptor (Lambda@Edge) to the website
 * cloudFront distribution.
 */
class CreateCloudFrontInterceptor extends Service {
  constructor() {
    super();
    this.dependency(['aws']);
  }

  async init() {
    await super.init();
  }

  async execute() {
    /*
     * Pseudo Code:
     * -- Get latest Lambda@Edge function ARN that needs to be configured from the settings
     * -- Get existing Lambda@Edge function version ARN configured on CloudFront
     * -- If no Lambda@Edge function is configured on CloudFront yet, then skip all checks and
     *    -- Publish new version of the Lambda@Edge function and
     *    -- Configure the new lambda version ARN on CloudFront and exit.
     * -- If some Lambda@Edge function version is configured on CloudFront then get CodeSha256 for that version
     * -- Get latest CodeSha256 value for the Lambda
     * -- If the CodeSha256 value for the latest Lambda@Edge matches the one that's configured on CloudFront, then
     *    -- There is nothing to do. The latest Lambda is already configured on CloudFront. Just return.
     * -- If the latest lambda@edge code Sha256 is different from what's configured then
     *    -- Publish new version of the Lambda@Edge function with latest Lambda code and
     *    -- Configure the new lambda version ARN on CloudFront
     *
     * Note: We need to publish Lambda Version using Lambda SDK here instead of simply using "AWS::Lambda::Version"
     * CloudFormation resource in the "edge-lambda" stack to publish Lambda. That's because the "AWS::Lambda::Version"
     * will end up publishing new version of the Lambda function every time. We want to publish only if the lambda@edge
     * code has changed.
     */
    const aws = await this.service('aws');
    const cloudFrontApi = new aws.sdk.CloudFront({ apiVersion: '2019-03-26' });
    const cloudFrontId = this.settings.get('cloudFrontId');

    // -- Get latest Lambda@Edge function ARN that needs to be configured from the settings
    const latestEdgeLambdaArn = this.settings.get('edgeLambdaArn');

    // -- Get existing Lambda@Edge function version ARN configured on CloudFront
    const cloudFrontConfig = await cloudFrontApi.getDistributionConfig({ Id: cloudFrontId }).promise();
    const existingLambdaArn = _.get(
      cloudFrontConfig,
      'DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations.Items.0.LambdaFunctionARN',
    );

    // -- If no Lambda@Edge function is configured on CloudFront yet, then skip all checks and
    //    -- Publish new version of the Lambda@Edge function and
    //    -- Configure the new lambda version ARN on CloudFront and exit
    if (_.isEmpty(existingLambdaArn)) {
      this.log.info(`No edge lambda configured for cloudfront distribution "${cloudFrontId}"".`);
      const publishedVersionArn = await this.publishNewLambdaVersion(latestEdgeLambdaArn);
      await this.updateCloudFrontConfig(cloudFrontId, cloudFrontConfig, publishedVersionArn);
      return;
    }

    // -- If some Lambda@Edge function version is configured on CloudFront then get CodeSha256 for that version
    const existingSha256 = existingLambdaArn && (await this.getLambdaCodeSha256(existingLambdaArn));
    // -- Get latest CodeSha256 value for the Lambda
    const latestSha256 = await this.getLambdaCodeSha256(latestEdgeLambdaArn);

    // -- If the CodeSha256 value for the latest Lambda@Edge matches the one that's configured on CloudFront, then
    //    -- There is nothing to do. The latest Lambda is already configured on CloudFront. Just return.
    if (existingSha256 === latestSha256) {
      this.log.info(
        `Skip updating cloudfront distribution "${cloudFrontId}"". The Lambda@Edge version "${latestEdgeLambdaArn}" is already configured and has latest code.`,
      );
      return;
    }

    // -- If the latest lambda@edge code Sha256 is different from what's configured then
    //    -- Publish new version of the Lambda@Edge function with latest Lambda code and
    //    -- Configure the new lambda version ARN on CloudFront
    const publishedVersionArn = await this.publishNewLambdaVersion(latestEdgeLambdaArn);
    await this.updateCloudFrontConfig(cloudFrontId, cloudFrontConfig, publishedVersionArn);
  }

  async getLambdaCodeSha256(lambdaArn) {
    const aws = await this.service('aws');
    const lambdaApi = new aws.sdk.Lambda({ apiVersion: '2015-03-31', region: 'us-east-1' });
    const lambdaInfo = await lambdaApi.getFunction({ FunctionName: lambdaArn }).promise();

    return lambdaInfo.Configuration.CodeSha256;
  }

  async publishNewLambdaVersion(lambdaArn) {
    const aws = await this.service('aws');
    const lambdaApi = new aws.sdk.Lambda({ apiVersion: '2015-03-31', region: 'us-east-1' });
    const lambdaInfo = await lambdaApi.publishVersion({ FunctionName: lambdaArn }).promise();

    // Return ARN pointing to the new Lambda version we just published
    return lambdaInfo.FunctionArn;
  }

  async updateCloudFrontConfig(cloudFrontId, cloudFrontConfig, lambdaVersionArn) {
    const aws = await this.service('aws');
    const cloudFrontApi = new aws.sdk.CloudFront({ apiVersion: '2019-03-26' });

    this.log.info(`Updating cloudfront distribution "${cloudFrontId}"`);

    // Prepare updateDistribution parameters
    // 1. Set cloudFrontID
    // 2. Set IfMatch to the value of ETag
    // 3. Remove ETag
    // See "https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudFront.html#updateDistribution-property" for details
    cloudFrontConfig.Id = cloudFrontId;
    cloudFrontConfig.IfMatch = cloudFrontConfig.ETag;
    delete cloudFrontConfig.ETag;

    // 4. Add Lambda@Edge's ARN
    _.set(cloudFrontConfig, 'DistributionConfig.DefaultCacheBehavior.LambdaFunctionAssociations', {
      Quantity: 1, // The number of Lambda function associations for this cache behavior. This needs to be same as Items.length
      Items: [
        {
          LambdaFunctionARN: lambdaVersionArn,
          EventType: 'origin-response',
        },
      ],
    });

    return cloudFrontApi.updateDistribution(cloudFrontConfig).promise();
  }
}

module.exports = CreateCloudFrontInterceptor;
